import { beforeEach, describe, expect, it, vi } from "vitest";
import { createLogger, type LogEntry } from "./logger.js";

describe("logger", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("formats log message with namespace and forwards to console", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const logger = createLogger("TestNamespace");

    logger.info("Server started", { port: 8080 });

    expect(infoSpy).toHaveBeenCalledWith("[TestNamespace] Server started", { port: 8080 });
  });

  it("suppresses debug messages by default when not enabled", () => {
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    const logger = createLogger("DebugNS");

    logger.debug("Verbose details");
    expect(debugSpy).not.toHaveBeenCalled();

    logger.setEnabled(true);
    // Even if enabled, minLevel defaults to 'info', so minLevel must also be 'debug'
    const debugLogger = createLogger("DebugNS2", { enabled: true, minLevel: "debug" });
    debugLogger.debug("Now enabled");
    expect(debugSpy).toHaveBeenCalledWith("[DebugNS2] Now enabled");
  });

  it("filters logs based on minLevel", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const logger = createLogger("WarnOnly", { minLevel: "warn" });

    logger.info("This should be skipped");
    expect(infoSpy).not.toHaveBeenCalled();

    logger.warn("This is a warning");
    expect(warnSpy).toHaveBeenCalledWith("[WarnOnly] This is a warning");

    logger.error("This is an error");
    expect(errorSpy).toHaveBeenCalledWith("[WarnOnly] This is an error");
  });

  it("calls custom listener callback with structured LogEntry", () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const entries: LogEntry[] = [];
    const logger = createLogger("Audit", {
      listener: (entry) => entries.push(entry),
    });

    logger.info("Action performed", "param1", 123);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      namespace: "Audit",
      level: "info",
      message: "Action performed",
      details: ["param1", 123],
    });
    expect(entries[0].timestamp).toBeInstanceOf(Date);
  });

  it("supports generic log method for all log levels", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const logger = createLogger("Generic");

    logger.log("warn", "Warning via log()");
    expect(warnSpy).toHaveBeenCalledWith("[Generic] Warning via log()");
  });

  it("manages enabled state via setEnabled and isEnabled", () => {
    const logger = createLogger("Toggle", { enabled: false });
    expect(logger.isEnabled()).toBe(false);

    logger.setEnabled(true);
    expect(logger.isEnabled()).toBe(true);
  });
});
