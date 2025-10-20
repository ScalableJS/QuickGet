export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  level: LogLevel;
  message: string;
  namespace: string;
  timestamp: Date;
  details?: unknown[];
}

export interface LoggerOptions {
  enabled?: boolean;
  listener?: (entry: LogEntry) => void;
  minLevel?: LogLevel;
}

const levelOrder: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export interface Logger {
  debug(message: string, ...details: unknown[]): void;
  info(message: string, ...details: unknown[]): void;
  warn(message: string, ...details: unknown[]): void;
  error(message: string, ...details: unknown[]): void;
  log(level: LogLevel, message: string, ...details: unknown[]): void;
  setEnabled(enabled: boolean): void;
  isEnabled(): boolean;
}

export function createLogger(namespace: string, options: LoggerOptions = {}): Logger {
  let enabled = Boolean(options.enabled);
  let minLevel = options.minLevel ?? "info";
  const listener = options.listener;

  const shouldEmit = (level: LogLevel): boolean => {
    if (level === "debug" && !enabled) {
      return false;
    }
    return levelOrder[level] >= levelOrder[minLevel];
  };

  const emit = (level: LogLevel, message: string, details: unknown[]): void => {
    if (listener) {
      listener({
        level,
        message,
        namespace,
        timestamp: new Date(),
        details,
      });
    }
  };

  const write = (level: LogLevel, method: "debug" | "info" | "warn" | "error", message: string, details: unknown[]): void => {
    if (!shouldEmit(level)) return;
    const prefix = `[${namespace}]`;
    (console[method] ?? console.log).call(console, `${prefix} ${message}`, ...details);
    emit(level, message, details);
  };

  const logger: Logger = {
    debug(message: string, ...details: unknown[]) {
      write("debug", "debug", message, details);
    },
    info(message: string, ...details: unknown[]) {
      write("info", "info", message, details);
    },
    warn(message: string, ...details: unknown[]) {
      write("warn", "warn", message, details);
    },
    error(message: string, ...details: unknown[]) {
      write("error", "error", message, details);
    },
    log(level: LogLevel, message: string, ...details: unknown[]) {
      const method = level === "debug" ? "debug" : level === "info" ? "info" : level === "warn" ? "warn" : "error";
      write(level, method, message, details);
    },
    setEnabled(value: boolean) {
      enabled = value;
    },
    isEnabled() {
      return enabled;
    },
  };

  return logger;
}
