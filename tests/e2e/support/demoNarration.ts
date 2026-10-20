import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import type { SceneMark, SceneRecorder } from "./sceneRecorder.js";

const run = promisify(execFile);
const voice = "en-US-EmmaMultilingualNeural";
const rate = "-5%";

/** One reviewed script supplies both the voice and the subtitle text. */
export const narrationText = [
  "This guide shows how to connect the QuickGet Chrome extension to QNAP Download Station, set download folders, and download torrents and regular files.",
  "Enter your NAS address and login details, then save to check the connection.",
  "Downloads start in the temporary folder. Download Station moves completed files to the target folder.",
  "Folder rules are optional. Here, names containing dot ISO go to dev. Other downloads keep the default target.",
  "Enable file links to send ordinary files to Download Station, then save these settings.",
  "Click the torrent link. QuickGet sends it to Download Station using the dev rule.",
  "This ZIP file does not match the ISO rule, so it uses the default Download folder.",
  "Open QuickGet to follow both downloads. The torrent card shows dev as its destination.",
];

export async function prepareNarration(directory: string) {
  await mkdir(directory, { recursive: true });
  const clips: Array<{ file: string; duration: number }> = [];
  for (const text of narrationText) {
    const hash = createHash("sha256").update(`${voice}\n${rate}\n${text}`).digest("hex").slice(0, 16);
    const file = path.join(directory, `${hash}.mp3`);
    if (
      !(await access(file).then(
        () => true,
        () => false,
      ))
    ) {
      await run("edge-tts", ["--voice", voice, `--rate=${rate}`, "--text", text, "--write-media", file]);
    }
    const { stdout } = await run("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "csv=p=0",
      file,
    ]);
    clips.push({ file, duration: Number(stdout) });
  }
  await writeFile(path.join(directory, "script.json"), JSON.stringify({ voice, rate, narrationText, clips }, null, 2));

  return {
    /** Finish the spoken sentence before advancing the visible scene. */
    async finishScene(recorder: SceneRecorder): Promise<void> {
      const index = recorder.sceneMarks.length - 1;
      const elapsed = recorder.currentTime - recorder.sceneMarks[index].at;
      await recorder.hold(Math.max(0, (clips[index].duration + 0.4 - elapsed) * 1_000));
    },
    async mix(marks: readonly SceneMark[], duration: number, output: string): Promise<void> {
      if (marks.length !== clips.length) throw new Error("Every narration clip needs one scene mark");
      const filters = clips.map((clip, index) => {
        const end = marks[index].at + clip.duration;
        if (end > (marks[index + 1]?.at ?? duration)) throw new Error(`Narration overlaps scene ${index + 1}`);
        return `[${index}:a]adelay=${Math.round(marks[index].at * 1_000)}:all=1[a${index}]`;
      });
      filters.push(
        `${clips.map((_, index) => `[a${index}]`).join("")}amix=inputs=${clips.length}:normalize=0,` +
          `apad,atrim=duration=${duration},loudnorm=I=-16:TP=-1.5:LRA=7[out]`,
      );
      await run("ffmpeg", [
        "-y",
        ...clips.flatMap((clip) => ["-i", clip.file]),
        "-filter_complex",
        filters.join(";"),
        "-map",
        "[out]",
        "-ar",
        "48000",
        output,
      ]);
    },
  };
}
