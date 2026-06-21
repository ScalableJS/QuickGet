import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestSettings } from "../../tests/fixtures/settings";
import { seedChromeStorage } from "../../tests/mocks/chrome";
import { server } from "../../tests/msw/server";

import { ensureMonitoring, handleAlarm, stopMonitoring } from "./alarms.js";

const BASE = "http://nas.local:8080/downloadstation/V4";

const ACTIVE_ICON = { 32: "icons/32_active.png", 128: "icons/128_active.png" };
const IDLE_ICON = { 32: "icons/32_download.png", 128: "icons/128_download.png" };

function loginHandler() {
  return http.post(`${BASE}/Misc/Login`, () => HttpResponse.json({ error: 0, sid: "SID-QNAP", user: "admin" }));
}

// Minimal Task/Query job. `state` drives the unified status (104=downloading,
// 8=finishing, 5=finished). A non-zero down_rate keeps a downloading job out of
// the "stopped" normalization branch.
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

  beforeEach(() => {
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
  });

  afterEach(() => {
    stopMonitoring(); // reset icon/badge state between tests
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
      queryHandler([job(104), job(8), job(5)], () => {
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
    server.use(loginHandler(), queryHandler([job(8)]));

    await handleAlarm({ name: "download-monitor" } as chrome.alarms.Alarm);

    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: "1" });
    expect(chrome.action.setIcon).toHaveBeenCalledWith({ path: ACTIVE_ICON });
    expect(alarms["download-monitor"]).toBeDefined(); // still polling
  });

  it("stops monitoring when nothing is in progress", async () => {
    alarms["download-monitor"] = { name: "download-monitor" } as chrome.alarms.Alarm;
    server.use(loginHandler(), queryHandler([job(5)])); // finished only

    await handleAlarm({ name: "download-monitor" } as chrome.alarms.Alarm);

    expect(chrome.action.setBadgeText).toHaveBeenLastCalledWith({ text: "" });
    expect(chrome.action.setIcon).toHaveBeenCalledWith({ path: IDLE_ICON });
    expect(alarms["download-monitor"]).toBeUndefined(); // alarm cleared
  });

  it("ensureMonitoring reflects active status immediately, before the first tick", async () => {
    server.use(loginHandler(), queryHandler([job(104), job(104), job(104)]));

    await ensureMonitoring();

    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: "3" });
    expect(chrome.action.setIcon).toHaveBeenCalledWith({ path: ACTIVE_ICON });
    expect(alarms["download-monitor"]).toBeDefined(); // alarm still armed
  });
});
