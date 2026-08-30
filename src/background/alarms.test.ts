import { loadSettings } from "@lib/settings.js";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestSettings } from "../../tests/fixtures/settings";
import { seedChromeStorage } from "../../tests/mocks/chrome";
import { server } from "../../tests/msw/server";

import { resetActionState } from "./actions.js";
import { armMonitoring, ensureMonitoring, handleAlarm } from "./alarms.js";

vi.mock("@lib/settings.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@lib/settings.js")>();
  return { ...actual, loadSettings: vi.fn(actual.loadSettings) };
});

const BASE = "http://nas.local:8080/downloadstation/V4";

const ACTIVE_ICON = { 32: "icons/32_active.png", 128: "icons/128_active.png" };

function loginHandler() {
  return http.post(`${BASE}/Misc/Login`, () => HttpResponse.json({ error: 0, sid: "SID-QNAP", user: "admin" }));
}

// Minimal Task/Query job. `state` drives the unified status (104=downloading,
// 3=moving, 5=finished).
function job(state: number, overrides: Record<string, unknown> = {}) {
  return {
    hash: `H${state}`,
    source: `task-${state}`,
    source_name: `task-${state}`,
    state,
    progress: state === 104 ? 42 : 100,
    size: 100,
    down_size: state === 104 ? 42 : 100,
    down_rate: state === 104 ? 1000 : 0,
    up_rate: 0,
    activity_time: 1,
    peers: 1,
    seeds: 1,
    total_files: 1,
    ...overrides,
  };
}

function queryHandler(jobs: ReturnType<typeof job>[], onHit?: () => void) {
  return http.post(`${BASE}/Task/Query`, () => {
    onHit?.();
    return HttpResponse.json({ error: 0, data: jobs, total: jobs.length });
  });
}

describe("background alarms", () => {
  let alarms: Record<string, chrome.alarms.Alarm>;

  beforeEach(async () => {
    seedChromeStorage({ ...createTestSettings() });
    alarms = {};
    (chrome as unknown as { alarms: Record<string, unknown> }).alarms = {
      onAlarm: { addListener: vi.fn() },
      get: vi.fn(async (name: string) => alarms[name]),
      create: vi.fn((name: string, info: chrome.alarms.AlarmCreateInfo) => {
        alarms[name] = { name, scheduledTime: 0, periodInMinutes: info.periodInMinutes } as chrome.alarms.Alarm;
      }),
      clear: vi.fn(async (name: string) => {
        delete alarms[name];
        return true;
      }),
    };
    await resetActionState(); // clean the persisted toolbar state (session storage persists across tests)
    vi.clearAllMocks(); // ...then start each test with a clean call history
  });

  afterEach(async () => {
    await resetActionState(); // leave the toolbar state clean for the next test
  });

  it("ensureMonitoring arms the alarm once and is idempotent", async () => {
    server.use(loginHandler(), queryHandler([job(104)]));

    await ensureMonitoring();
    await ensureMonitoring();

    const create = (chrome.alarms as unknown as { create: ReturnType<typeof vi.fn> }).create;
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith("download-monitor", {
      delayInMinutes: 0.5,
      periodInMinutes: 0.5,
    });
  });

  it("counts in-progress tasks (incl. finishing) for the badge, matching the popup", async () => {
    let queryHits = 0;
    let statusHit = false;
    server.use(
      loginHandler(),
      // downloading + finishing are in progress; finished is not → badge "2".
      queryHandler([job(104), job(3), job(5)], () => {
        queryHits += 1;
      }),
      http.post(`${BASE}/Task/Status`, () => {
        statusHit = true;
        return HttpResponse.json({ error: 0, data: {} });
      }),
    );

    await handleAlarm({ name: "download-monitor" } as chrome.alarms.Alarm);

    expect(queryHits).toBe(1);
    expect(statusHit).toBe(false); // the aggregate can't see finishing/checking — we need the list
    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: "2" });
    expect(chrome.action.setIcon).toHaveBeenCalledWith({ path: ACTIVE_ICON });
  });

  it("keeps the badge active for a finishing task (regression: cleared too early)", async () => {
    alarms["download-monitor"] = { name: "download-monitor" } as chrome.alarms.Alarm;
    server.use(loginHandler(), queryHandler([job(3)]));

    await handleAlarm({ name: "download-monitor" } as chrome.alarms.Alarm);

    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: "1" });
    expect(chrome.action.setIcon).toHaveBeenCalledWith({ path: ACTIVE_ICON });
    expect(alarms["download-monitor"]).toBeDefined(); // still polling
  });

  it("stops monitoring on a successful zero — the NAS snapshot is authoritative", async () => {
    alarms["download-monitor"] = { name: "download-monitor" } as chrome.alarms.Alarm;
    server.use(loginHandler(), queryHandler([job(5)])); // finished only — nothing in progress

    await handleAlarm({ name: "download-monitor" } as chrome.alarms.Alarm);

    expect(alarms["download-monitor"]).toBeUndefined(); // idle → alarm cleared
  });

  it("stops polling an unreachable NAS and flags the toolbar", async () => {
    alarms["download-monitor"] = { name: "download-monitor" } as chrome.alarms.Alarm;
    server.use(
      loginHandler(),
      http.post(`${BASE}/Task/Query`, () => new HttpResponse(null, { status: 500 })),
    );

    // A failed query invalidates the displayed state at once: stale counts are
    // worse than an explicit "unavailable".
    await handleAlarm({ name: "download-monitor" } as chrome.alarms.Alarm);

    expect(alarms["download-monitor"]).toBeUndefined();
    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: "!" });
  });

  it("serializes concurrent arm requests into one alarm creation", async () => {
    let releaseGet!: () => void;
    const getGate = new Promise<void>((resolve) => {
      releaseGet = resolve;
    });
    const get = vi.mocked(chrome.alarms.get);
    get.mockImplementationOnce(async () => {
      await getGate;
      return undefined;
    });

    const first = armMonitoring();
    const second = armMonitoring();
    releaseGet();
    await Promise.all([first, second]);

    expect(chrome.alarms.create).toHaveBeenCalledTimes(1);
  });

  it("ensureMonitoring reflects active status immediately, before the first tick", async () => {
    server.use(loginHandler(), queryHandler([job(104), job(104), job(104)]));

    await ensureMonitoring();

    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: "3" });
    expect(chrome.action.setIcon).toHaveBeenCalledWith({ path: ACTIVE_ICON });
    expect(alarms["download-monitor"]).toBeDefined(); // alarm still armed
  });

  it("coalesces overlapping monitor requests into the current poll and one catch-up poll", async () => {
    let queryHits = 0;
    let releaseFirstQuery!: () => void;
    let signalFirstQuery!: () => void;
    const firstQueryGate = new Promise<void>((resolve) => {
      releaseFirstQuery = resolve;
    });
    const firstQueryReached = new Promise<void>((resolve) => {
      signalFirstQuery = resolve;
    });
    server.use(
      loginHandler(),
      http.post(`${BASE}/Task/Query`, async () => {
        queryHits += 1;
        if (queryHits === 1) {
          signalFirstQuery();
          await firstQueryGate;
        }
        const tasks = queryHits === 1 ? [] : [job(104)];
        return HttpResponse.json({ error: 0, data: tasks, total: tasks.length });
      }),
    );

    const first = ensureMonitoring();
    await firstQueryReached;
    const second = ensureMonitoring();
    const third = ensureMonitoring();
    releaseFirstQuery();
    await Promise.all([first, second, third]);

    expect(queryHits).toBe(2);
    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: "1" });
  });

  it("replaces a previously active toolbar with attention when settings become invalid", async () => {
    server.use(loginHandler(), queryHandler([job(104)]));
    await ensureMonitoring();
    vi.clearAllMocks();

    seedChromeStorage(createTestSettings({ NASaddress: "" }));
    await handleAlarm({ name: "download-monitor" } as chrome.alarms.Alarm);

    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: "!" });
    expect(chrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith({ color: "#D93025" });
    expect(alarms["download-monitor"]).toBeUndefined();
  });

  it("loads one settings snapshot for each monitoring tick", async () => {
    server.use(loginHandler(), queryHandler([job(104)]));
    vi.mocked(loadSettings).mockClear();

    await handleAlarm({ name: "download-monitor" } as chrome.alarms.Alarm);

    expect(loadSettings).toHaveBeenCalledTimes(1);
  });
});

/**
 * A fresh install has no NAS address. Polling anyway threw "NAS address is empty" on every
 * browser start, and Chrome collects those on the extension's Errors page — so an extension
 * that had simply never been set up presented itself as broken.
 */
describe("monitoring an unconfigured extension", () => {
  it("stays silent and does not poll", async () => {
    seedChromeStorage(createTestSettings({ NASaddress: "" }));
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    let polled = false;

    server.use(
      http.post("http://nas.local:8080/downloadstation/V4/Task/Query", () => {
        polled = true;
        return HttpResponse.json({ error: 0, data: [] });
      }),
    );

    await ensureMonitoring();

    expect(polled).toBe(false);
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it("polls normally once it is configured", async () => {
    seedChromeStorage(createTestSettings());
    let polled = false;

    server.use(
      http.post("http://nas.local:8080/downloadstation/V4/Misc/Login", () =>
        HttpResponse.json({ error: 0, sid: "SID-QNAP", user: "admin" }),
      ),
      http.post("http://nas.local:8080/downloadstation/V4/Task/Query", () => {
        polled = true;
        return HttpResponse.json({ error: 0, data: [] });
      }),
    );

    await ensureMonitoring();

    expect(polled).toBe(true);
  });
});
