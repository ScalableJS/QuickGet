import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Pause lengths, per the `demo-video` skill. Pause AFTER something changed the screen — never
 * between steps where it did not.
 */
export const READ = {
  glance: 900,
  normal: 1_600,
  page: 2_200,
  /** The shot the viewer is meant to study, not merely register. */
  study: 3_800,
} as const;

/** Floor for the final caption only; every other one ends where the next begins. */
const MIN_CAPTION_SECONDS = 1.2;

export interface SceneMark {
  /** Position in the recording, in seconds — taken from ffmpeg, not from wall-clock. */
  at: number;
  caption: string;
}

export interface SceneRecorderOptions {
  /** Where the master lands. */
  outputPath: string;
  /**
   * avfoundation input. Defaults to `"0:none"` — screen 0, no audio — which is what
   * `ffmpeg -f avfoundation -list_devices true -i ""` reports on this machine
   * (`[0] Capture screen 0`). Re-check on another machine before assuming the index.
   */
  input?: string;
  framerate?: number;
  /** Crop applied at capture time, e.g. "1920:1080:200:100" for a placed window. */
  crop?: string;
  /** Overrides the input format; only needed to drive the recorder from a synthetic source. */
  inputFormat?: string;
  /**
   * Adds `-re`, pacing a non-real-time input at its native rate. Only useful for testing the
   * recorder against a synthetic source — a real screen capture is already real-time.
   */
  realtimeInput?: boolean;
  /**
   * Draws the OS pointer into the capture. **Off by default and rarely right here:** Playwright
   * never moves the macOS cursor, so this records a stationary arrow. Only enable it when
   * something genuinely drives the physical pointer.
   */
  captureCursor?: boolean;
  /** Intermediate capture bitrate. Generous on purpose — quality is decided in `finishMaster()`. */
  captureBitrate?: string;
}

/**
 * Drives an ffmpeg screen capture and timestamps captions against **the recording's own clock**.
 *
 * The reason this exists rather than a `Date.now()` helper: caption times must line up with the
 * frames they describe. Wall-clock drifts from media time (capture start-up, dropped frames), and
 * a caption that slides off its beat makes the video misdescribe what is on screen. ffmpeg is
 * asked for `-progress pipe:1`, and `out_time_us` from that stream is the single source of truth.
 *
 * A mark is taken **after an assertion passes**, so every caption is anchored to a confirmed
 * product fact rather than to an intended moment.
 */
export class SceneRecorder {
  private process: ChildProcessWithoutNullStreams | null = null;
  private mediaTimeMs = 0;
  private sawFrames = false;
  private startedAt = 0;
  private readonly marks: SceneMark[] = [];

  constructor(private readonly options: SceneRecorderOptions) {}

  /**
   * How far the recording's clock has drifted from wall-clock, in seconds.
   *
   * A real-time screen capture tracks wall-clock closely, so a large drift means the source is
   * not real-time (a synthetic `lavfi` input races ahead) or frames are being dropped badly.
   * Either way the caption times would no longer describe the frames they sit on, so the run is
   * not usable as a master — check this before trusting the `.srt`.
   */
  get drift(): number {
    if (!this.startedAt) return 0;
    return this.currentTime - (Date.now() - this.startedAt) / 1_000;
  }

  /** Seconds into the recording, as last reported by ffmpeg itself. */
  get currentTime(): number {
    return this.mediaTimeMs / 1_000;
  }

  get sceneMarks(): readonly SceneMark[] {
    return this.marks;
  }

  /**
   * Sets the capture rectangle after the window has been placed and *measured*. The crop must come
   * from the bounds Chrome granted, not the ones requested, so it cannot be known at construction.
   */
  setCrop(crop: string): void {
    if (this.process) throw new Error("Cannot change the crop once recording has started");
    this.options.crop = crop;
  }

  /**
   * Starts the capture and resolves once ffmpeg has actually produced frames — the opening frames
   * of a capture are routinely dropped or half-painted, so marking before that would anchor the
   * first caption to nothing.
   */
  async start(readyTimeoutMs = 15_000): Promise<void> {
    if (this.process) throw new Error("Recorder already started");

    await mkdir(path.dirname(this.options.outputPath), { recursive: true });

    const filters = this.options.crop ? ["-vf", `crop=${this.options.crop}`] : [];
    const format = this.options.inputFormat ?? "avfoundation";

    // `-capture_cursor` defaults OFF: Playwright drives Chrome through CDP and never moves the
    // OS pointer (measured — it stayed put across `mouse.move()` and `click()`), so enabling it
    // records a stationary arrow rather than a cursor following the action.
    const captureFlags =
      format === "avfoundation"
        ? [
            "-framerate",
            String(this.options.framerate ?? 30),
            "-capture_cursor",
            this.options.captureCursor ? "1" : "0",
            // Keep late frames instead of letting avfoundation drop them: a dropped frame shifts
            // the media clock the captions are timed against.
            "-drop_late_frames",
            "0",
          ]
        : [];

    this.process = spawn("ffmpeg", [
      "-y",
      ...(this.options.realtimeInput ? ["-re"] : []),
      "-f",
      format,
      ...captureFlags,
      "-i",
      this.options.input ?? "0:none",
      ...filters,
      // Capture hardware-encoded and finish for quality later. A real-time capture that cannot
      // keep up drops frames, which corrupts the very timestamps the captions rely on, so the
      // master is deliberately a fast intermediate — `finishMaster()` does the slow x264 pass.
      "-c:v",
      "h264_videotoolbox",
      "-realtime",
      "1",
      "-profile:v",
      "high",
      "-b:v",
      this.options.captureBitrate ?? "35M",
      "-pix_fmt",
      "nv12",
      "-progress",
      "pipe:1",
      "-stats_period",
      "0.1",
      this.options.outputPath,
    ]);

    this.process.stdout.setEncoding("utf8");
    this.process.stdout.on("data", (chunk: string) => this.consumeProgress(chunk));

    const deadline = Date.now() + readyTimeoutMs;
    while (!this.sawFrames) {
      if (Date.now() > deadline) {
        await this.stop().catch(() => {});
        throw new Error("ffmpeg produced no frames — check the avfoundation input index");
      }
      await delay(100);
    }
    this.startedAt = Date.now() - this.mediaTimeMs;
  }

  /**
   * Fails the run when the recording clock has run away from wall-clock, which would make every
   * caption sit on the wrong frame. Call before writing the `.srt`.
   */
  assertRealTime(toleranceSeconds = 2): void {
    const drift = Math.abs(this.drift);
    if (drift > toleranceSeconds) {
      throw new Error(
        `Recording is not real-time: media clock drifted ${drift.toFixed(1)}s from wall-clock. ` +
          "Caption timings would not match the frames.",
      );
    }
  }

  /**
   * Records a caption at the current media time. Call it immediately after the assertion that
   * proves the beat actually happened.
   */
  mark(caption: string): void {
    if (!this.process) throw new Error("Recorder not started");
    this.marks.push({ at: this.currentTime, caption });
  }

  /**
   * Composition breathing room. The only sleep the method permits, and only *after* the facts are
   * confirmed — never to wait for the application.
   */
  async hold(ms: number): Promise<void> {
    await delay(ms);
  }

  /** Writes `q` to ffmpeg's stdin and waits for exit, so the container is finalised properly. */
  async stop(): Promise<void> {
    const process = this.process;
    if (!process) return;
    this.process = null;

    process.stdin.write("q");
    await Promise.race([once(process, "exit"), delay(10_000)]);
    if (process.exitCode === null) process.kill("SIGKILL");
  }

  /** Emits the caption track, timed against the recording rather than wall-clock. */
  async writeSrt(srtPath: string): Promise<void> {
    if (this.marks.length === 0) return;

    const lastMark = this.marks[this.marks.length - 1];
    const end = Math.max(this.currentTime, lastMark.at + MIN_CAPTION_SECONDS);

    // A caption runs until the next one starts. Never extend it past that: padding a short beat
    // to a minimum length would overlap the following caption, and players render overlapping
    // cues unpredictably. Only the last caption may be stretched, since nothing follows it.
    const blocks = this.marks.map((mark, index) => {
      const next = this.marks[index + 1]?.at;
      const stop = next ?? Math.max(end, mark.at + MIN_CAPTION_SECONDS);
      return `${index + 1}\n${srtTime(mark.at)} --> ${srtTime(stop)}\n${mark.caption}\n`;
    });

    await mkdir(path.dirname(srtPath), { recursive: true });
    await writeFile(srtPath, `${blocks.join("\n")}\n`, "utf8");
  }

  private consumeProgress(chunk: string): void {
    for (const line of chunk.split("\n")) {
      const [key, value] = line.split("=");
      if (key === "out_time_us") {
        const micros = Number(value);
        if (Number.isFinite(micros) && micros >= 0) {
          this.mediaTimeMs = micros / 1_000;
          if (micros > 0) this.sawFrames = true;
        }
      }
    }
  }
}

/**
 * Second pass: turn the fast intermediate capture into the deliverable, off the clock.
 *
 * Splitting capture from quality is the point. A slow x264 preset running live would drop frames
 * and corrupt the caption timings; here nothing is real-time, so the encoder can take as long as
 * it likes. `-crf 17` with a `slow` preset is what keeps small UI text legible — there is no
 * Retina supersampling on the recording display, so the encoder is all that protects glyph edges.
 *
 * `subtitles` are muxed as a **soft `mov_text` track**, selectable in a player and still editable
 * afterwards. Burning them into the picture is not offered: the local ffmpeg is built without
 * libass, so the `subtitles` filter does not exist here (verified — it fails with "Error parsing a
 * filter description" no matter how the path is escaped). Burn-in would need an ffmpeg with
 * `--enable-libass`.
 */
export async function finishMaster(options: {
  capturePath: string;
  outputPath: string;
  /** Path to an `.srt`, muxed as a selectable track. */
  subtitles?: string;
}): Promise<void> {
  const subtitleInput = options.subtitles ? ["-i", options.subtitles] : [];
  const subtitleCodec = options.subtitles ? ["-c:s", "mov_text", "-metadata:s:s:0", "language=eng"] : [];

  await new Promise<void>((resolve, reject) => {
    const encoder = spawn("ffmpeg", [
      "-y",
      "-i",
      options.capturePath,
      ...subtitleInput,
      "-c:v",
      "libx264",
      "-preset",
      "slow",
      "-crf",
      "17",
      "-pix_fmt",
      "yuv420p",
      ...subtitleCodec,
      "-movflags",
      "+faststart",
      options.outputPath,
    ]);

    encoder.on("error", reject);
    encoder.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg finish pass exited with ${code}`)),
    );
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function srtTime(seconds: number): string {
  const clamped = Math.max(0, seconds);
  const whole = Math.floor(clamped);
  const millis = Math.round((clamped - whole) * 1_000);
  const hh = String(Math.floor(whole / 3_600)).padStart(2, "0");
  const mm = String(Math.floor((whole % 3_600) / 60)).padStart(2, "0");
  const ss = String(whole % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss},${String(millis).padStart(3, "0")}`;
}
