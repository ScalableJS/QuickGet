import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestSettings } from "../../tests/fixtures/settings";
import { seedChromeStorage } from "../../tests/mocks/chrome";
import { server } from "../../tests/msw/server";

import { ensureMonitoring, handleAlarm, stopMonitoring } from "./alarms.js";

const BASE = "http://nas.local:8080/downloadstation/V4";

function loginHandler() {
  return http.post(`${BASE}/Misc/Login`, () => HttpResponse.json({ error: 0, sid: "SID-QNAP", user: "admin" }));
}

function statusHandler(status: Record<string, number>, onHit?: () => void) {
  return http.post(`${BASE}/Task/Status`, () => {
    onHit?.();
    return HttpResponse.json({ error: 0, data: status });
  });
}

const fullStatus = (active: number) => ({
  active,
  all: 6,
  bt: 0,
  completed: 0,
  down_rate: 1000,
  downloading: active,
  inactive: 0,
  paused: 0,
  seeding: 0,
  stopped: 0,
  up_rate: 0,
  url: 0,
});

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
    server.use(loginHandler(), statusHandler(fullStatus(1)));

    await ensureMonitoring();
    await ensureMonitoring();

    const create = (chrome.alarms as unknown as { create: ReturnType<typeof vi.fn> }).create;
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith("download-monitor", {
      delayInMinutes: 0.5,
      periodInMinutes: 0.5,
    });
  });

  it("polls the cheap Status endpoint (not the full task list) and updates the badge", async () => {
    let statusHits = 0;
    let queryHit = false;
    server.use(
      loginHandler(),
      statusHandler(fullStatus(2), () => {
        statusHits += 1;
      }),
      http.post(`${BASE}/Task/Query`, () => {
        queryHit = true;
        return HttpResponse.json({ error: 0, data: [] });
      }),
    );

    await handleAlarm({ name: "download-monitor" } as chrome.alarms.Alarm);

    expect(statusHits).toBe(1);
    expect(queryHit).toBe(false); // #7: must not pull the whole task array
    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: "2" });
    expect(chrome.action.setIcon).toHaveBeenCalledWith({
      path: { 32: "icons/32_active.png", 128: "icons/128_active.png" },
    });
  });

  it("stops monitoring when nothing is active", async () => {
    alarms["download-monitor"] = { name: "download-monitor" } as chrome.alarms.Alarm;
    server.use(loginHandler(), statusHandler(fullStatus(0)));

    await handleAlarm({ name: "download-monitor" } as chrome.alarms.Alarm);

    expect(chrome.action.setBadgeText).toHaveBeenLastCalledWith({ text: "" });
    expect(chrome.action.setIcon).toHaveBeenCalledWith({
      path: { 32: "icons/32_download.png", 128: "icons/128_download.png" },
    });
    expect(alarms["download-monitor"]).toBeUndefined(); // alarm cleared
  });

  it("ensureMonitoring reflects active status immediately, before the first tick", async () => {
    server.use(loginHandler(), statusHandler(fullStatus(3)));

    await ensureMonitoring();

    // Feedback appears without waiting for the 30s alarm tick.
    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: "3" });
    expect(chrome.action.setIcon).toHaveBeenCalledWith({
      path: { 32: "icons/32_active.png", 128: "icons/128_active.png" },
    });
    expect(alarms["download-monitor"]).toBeDefined(); // alarm still armed
  });
});
