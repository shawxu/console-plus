export const LOG_LEVELS = ["debug", "error", "info", "log", "warn"] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

const LEVEL_SET: ReadonlySet<string> = new Set(LOG_LEVELS);

export function isLogLevel(value: unknown): value is LogLevel {
  return typeof value === "string" && LEVEL_SET.has(value);
}

/** 非法级别必须显式失败，绝不像 v1 那样静默回落到「全部日志」。 */
export function assertLogLevel(value: unknown, field = "level"): asserts value is LogLevel {
  if (!isLogLevel(value)) {
    throw new TypeError(
      `[console-plus] Invalid ${field} ${JSON.stringify(value)}. Expected one of: ${LOG_LEVELS.join(", ")}.`,
    );
  }
}
