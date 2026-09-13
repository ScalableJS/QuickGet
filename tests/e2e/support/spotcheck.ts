import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { Task } from "../../../src/lib/tasks.js";

import type { RealNasEnv } from "./e2eEnv.js";
import { createRealNasClient, rootDir } from "./realNasClient.js";

/**
 * Support for the pre-production spot check — the only suite that talks to the owner's real NAS.
 *
 * Two concerns live here, and both exist because the machine under test is somebody's actual
 * hardware with their actual downloads on it: **ownership**, so the run can never touch a task it
 * did not create, and **semantic waiting**, so a failure names the contract that broke rather than
 * reporting that sixty seconds elapsed. The previous real-NAS spec failed with exactly that bare
 * timeout and stayed broken for two months because the message said nothing.
 */

/** Everything this suite creates is named with this prefix. Nothing else is ever removed. */
export const OWNED_PREFIX = "qgr-spotcheck-";

const LEDGER_PATH = path.join(rootDir, ".e2e-artifacts", "spotcheck-ledger.json");

type OwnedTask = { name: string; identifier?: string };
type LedgerEntry = { runId: string; createdAt: string; tasks: OwnedTask[] };
type Ledger = { runs: LedgerEntry[] };

/** `qgr-spotcheck-<date>-<random>`, unique per run and usable as part of a filename. */
export function newRunId(): string {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `${OWNED_PREFIX}${stamp}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * A durable record of what this run created.
 *
 * A name prefix alone is not enough ownership. If the process dies between `AddUrl` and the
 * assertion that follows it, nothing in memory remembers the task — and a later run that cleans
 * "everything that looks like ours" is one bad prefix away from deleting a stranger's download.
 * The ledger is written **before** the task is used, so recovery has something to work from.
 */
export class TaskLedger {
  constructor(private readonly runId: string) {}

  /**
   * Declare a name **before** creating anything with it.
   *
   * The identifier only exists once the NAS has the task, so recording after creation leaves a
   * window: the three orphans this suite left on a real NAS during development all died in it —
   * `AddTorrent` succeeded, the next call failed, and nothing remembered what had been made.
   */
  async intend(name: string): Promise<void> {
    await this.mutate((run) => {
      if (!run.tasks.some((task) => task.name === name)) run.tasks.push({ name });
    });
  }

  /** Attach the identifier once the NAS reports the task, so removal can be exact. */
  async record(identifier: string, name: string): Promise<void> {
    await this.mutate((run) => {
      const existing = run.tasks.find((task) => task.name === name);
      if (existing) existing.identifier = identifier;
      else run.tasks.push({ identifier, name });
    });
  }

  private async mutate(change: (run: LedgerEntry) => void): Promise<void> {
    const ledger = await readLedger();
    let run = ledger.runs.find((entry) => entry.runId === this.runId);
    if (!run) {
      run = { runId: this.runId, createdAt: new Date().toISOString(), tasks: [] };
      ledger.runs.push(run);
    }
    change(run);
    await writeLedger(ledger);
  }

  /** Remove everything this run created, then forget it. Called in `finally`, never skipped. */
  async releaseRun(env: RealNasEnv): Promise<{ removed: number; failed: string[] }> {
    const ledger = await readLedger();
    const run = ledger.runs.find((entry) => entry.runId === this.runId);
    if (!run) return { removed: 0, failed: [] };

    const outcome = await removeRecorded(env, run.tasks);
    // A run whose cleanup failed keeps its entry, so the next run inherits the debt rather than
    // losing it. Only fully-cleaned runs are forgotten.
    ledger.runs = outcome.failed.length
      ? ledger.runs.map((entry) =>
          entry.runId === this.runId
            ? { ...entry, tasks: entry.tasks.filter((task) => outcome.failed.includes(task.name)) }
            : entry,
        )
      : ledger.runs.filter((entry) => entry.runId !== this.runId);
    await writeLedger(ledger);
    return outcome;
  }
}

/**
 * Clean up after runs that died before they could.
 *
 * Runs **before anything is created**, not after: a gate that starts by adding a task to a NAS
 * already holding yesterday's leftovers is how a 30-task limit gets reached during a release.
 */
export async function recoverStaleRuns(env: RealNasEnv, currentRunId: string): Promise<number> {
  const ledger = await readLedger();
  const stale = ledger.runs.filter((entry) => entry.runId !== currentRunId);
  // No early return on an empty ledger: an orphan is exactly a task the ledger never heard about,
  // so the sweep below is the case that matters most when there is nothing recorded.
  let removed = 0;
  const survivors: LedgerEntry[] = [];
  for (const run of stale) {
    const outcome = await removeRecorded(env, run.tasks);
    removed += outcome.removed;
    if (outcome.failed.length) {
      survivors.push({ ...run, tasks: run.tasks.filter((task) => outcome.failed.includes(task.name)) });
    }
  }

  ledger.runs = [...survivors, ...ledger.runs.filter((entry) => entry.runId === currentRunId)];
  await writeLedger(ledger);
  return removed + (await sweepOrphans(env, currentRunId));
}

/**
 * The safety net under the ledger: tasks whose name carries this suite's prefix but which no
 * ledger entry claims.
 *
 * A prefix sweep would be reckless against a vague pattern. `qgr-spotcheck-` is not vague — no
 * human names a download that, and nothing but this suite creates one. It exists because the
 * ledger cannot cover the window between the NAS accepting a task and the test learning its
 * identifier, and that window is precisely where the orphans appeared.
 */
async function sweepOrphans(env: RealNasEnv, currentRunId: string): Promise<number> {
  const client = createRealNasClient(env);
  const { tasks } = await client.queryTasks({ params: { limit: 0 } });
  const orphans = tasks.filter((task) => task.name.startsWith(OWNED_PREFIX) && !task.name.includes(currentRunId));

  let removed = 0;
  for (const task of orphans) {
    const identifier = task.hash ?? task.id;
    if (!identifier) continue;
    try {
      await client.removeTask(identifier, { clean: true });
      removed += 1;
    } catch {
      // Left for the next run rather than failing preflight: an orphan is debt, not a blocker.
    }
  }
  return removed;
}

export type Preflight = {
  runId: string;
  taskCount: number;
  headroom: number;
  recovered: number;
  /** What the run can honestly say it tested against. See the note in `preflight`. */
  target: string;
};

/**
 * Everything that must be true before the gate creates anything.
 *
 * Download Station's task ceiling is 30, so headroom is checked rather than assumed: the suite
 * needs two free slots, and a NAS already at its limit must fail here with a clear reason instead
 * of inside an unrelated assertion.
 *
 * **On recording a firmware version:** it would belong in the evidence — a green run against an
 * unrecorded box proves less — but the Download Station V4 API does not expose one. `Misc/Version`,
 * `Misc/Config` and `Misc/About` all answer `{"error":2,"reason":"no such api"}`, and the web
 * app's own bundle carries no version marker. Rather than invent a field, the run records the
 * target it can actually verify and this note says why that is all.
 */
export async function preflight(env: RealNasEnv, runId: string): Promise<Preflight> {
  const client = createRealNasClient(env);

  // Reaching Task/Status at all is the first thing that must hold: it is one authenticated
  // round-trip, so a credential or routing fault fails here rather than three scenarios later.
  const status = await client.getStatus();
  const recovered = await recoverStaleRuns(env, runId);
  const { tasks } = await client.queryTasks({ params: { limit: 0 } });

  const scheme = env.secure ? "https" : "http";
  const target = `Download Station V4 at ${scheme}://${env.host}:${env.port} (${status.all} tasks, ${status.downloading} downloading)`;
  const headroom = 30 - tasks.length;
  if (headroom < 2) {
    throw new Error(
      `Spot check refuses to run: Download Station holds ${tasks.length} tasks and its limit is 30. ` +
        `Free at least two slots first. Recovered ${recovered} task(s) from earlier runs.`,
    );
  }

  return { runId, taskCount: tasks.length, headroom, recovered, target };
}

export type WaitOptions = {
  /** What this wait is for, in words. Printed verbatim on failure — make it a contract. */
  what: string;
  timeoutMs?: number;
  intervalMs?: number;
  /** Extra lines printed on failure: the last snapshots, the fixture's request log. */
  diagnose?: () => string[] | Promise<string[]>;
};

/**
 * Poll until `probe` returns something, then return it.
 *
 * The point is the failure message. `Test timeout of 60000ms exceeded` is what let the previous
 * real-NAS spec rot unnoticed; this says which contract was being waited on, for how long, and
 * what the NAS was actually reporting while it waited.
 */
export async function waitFor<T>(probe: () => Promise<T | undefined>, options: WaitOptions): Promise<T> {
  const timeoutMs = options.timeoutMs ?? 45_000;
  const intervalMs = options.intervalMs ?? 1_000;
  const startedAt = Date.now();

  for (;;) {
    const value = await probe();
    if (value !== undefined) return value;

    if (Date.now() - startedAt > timeoutMs) {
      const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
      const extra = (await options.diagnose?.()) ?? [];
      throw new Error(
        [`Spot check gave up waiting.`, `  operation: ${options.what}`, `  elapsed:   ${elapsed}s`, ...extra].join(
          "\n",
        ),
      );
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

/** The task this run created, found by its owned name. Undefined until the NAS has it. */
export async function findOwnTask(env: RealNasEnv, name: string): Promise<Task | undefined> {
  const client = createRealNasClient(env);
  const { tasks } = await client.queryTasks({ params: { limit: 0 } });
  return tasks.find((task) => task.name === name) ?? tasks.find((task) => task.name.includes(name));
}

/** One line per task, for a failure message that shows what the NAS was actually reporting. */
export function describeTask(task: Task | undefined): string {
  if (!task) return "  task:      not present in Task/Query";
  return (
    `  task:      ${task.name}\n` +
    `    status:  ${task.status}\n` +
    `    bytes:   ${task.downloadedBytes} / ${task.sizeBytes}\n` +
    `    dest:    ${task.destination ?? "(none reported)"}`
  );
}

async function removeRecorded(env: RealNasEnv, tasks: OwnedTask[]): Promise<{ removed: number; failed: string[] }> {
  const client = createRealNasClient(env);
  const failed: string[] = [];
  let removed = 0;

  for (const task of tasks) {
    // Ownership is checked again here, not merely trusted from the ledger: removal is the one
    // irreversible thing this suite does to somebody's live machine.
    if (!task.name.startsWith(OWNED_PREFIX)) continue;
    try {
      // An intent recorded before creation has no identifier yet. Resolve it by name; if the task
      // never reached the NAS there is nothing to remove and the intent simply clears.
      const identifier = task.identifier ?? (await findOwnTask(env, task.name))?.hash;
      if (!identifier) continue;
      await client.removeTask(identifier, { clean: true });
      removed += 1;
    } catch {
      failed.push(task.name);
    }
  }
  return { removed, failed };
}

async function readLedger(): Promise<Ledger> {
  try {
    return JSON.parse(await readFile(LEDGER_PATH, "utf8")) as Ledger;
  } catch {
    return { runs: [] };
  }
}

async function writeLedger(ledger: Ledger): Promise<void> {
  await mkdir(path.dirname(LEDGER_PATH), { recursive: true });
  await writeFile(LEDGER_PATH, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");
}
