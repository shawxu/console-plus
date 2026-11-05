import type { LogRecord } from "./types";

const MAX_DEPTH = 4;
const MAX_STRING = 2000;
const MAX_ITEMS = 20;

function truncate(value: string): string {
  return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…[truncated]` : value;
}

/** 永不抛异常：Symbol / Error / 循环引用 / BigInt / getter 抛错 都能安全降级。 */
export function serializeArg(value: unknown): string {
  try {
    return truncate(serialize(value, 0, new WeakSet<object>()));
  } catch {
    return "[Unserializable]";
  }
}

export function formatArgs(args: readonly unknown[]): readonly string[] {
  return args.map(serializeArg);
}

function serialize(value: unknown, depth: number, seen: WeakSet<object>): string {
  if (value === null) return "null";

  switch (typeof value) {
    case "undefined":
      return "undefined";
    case "string":
      return value;
    case "number":
      return Number.isNaN(value) ? "NaN" : String(value);
    case "boolean":
      return String(value);
    case "bigint":
      return `${value}n`;
    case "symbol":
      return value.toString();
    case "function":
      return `[Function ${value.name || "anonymous"}]`;
    case "object":
      break;
    default:
      return String(value);
  }

  if (value instanceof Error) return value.stack || `${value.name}: ${value.message}`;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof RegExp) return value.toString();
  if (depth >= MAX_DEPTH) return "[…]";
  if (seen.has(value)) return "[Circular]";

  seen.add(value);
  try {
    if (Array.isArray(value)) {
      const items = value.slice(0, MAX_ITEMS).map((item) => serialize(item, depth + 1, seen));
      if (value.length > MAX_ITEMS) items.push(`…+${value.length - MAX_ITEMS}`);
      return `[${items.join(", ")}]`;
    }
    if (value instanceof Map) {
      const items = Array.from(value.entries())
        .slice(0, MAX_ITEMS)
        .map(
          ([key, item]) =>
            `${serialize(key, depth + 1, seen)} => ${serialize(item, depth + 1, seen)}`,
        );
      return `Map(${value.size}) {${items.join(", ")}}`;
    }
    if (value instanceof Set) {
      const items = Array.from(value.values())
        .slice(0, MAX_ITEMS)
        .map((item) => serialize(item, depth + 1, seen));
      return `Set(${value.size}) {${items.join(", ")}}`;
    }

    const keys = Object.keys(value);
    const parts = keys.slice(0, MAX_ITEMS).map((key) => {
      const item = (value as Record<string, unknown>)[key];
      return `${key}: ${serialize(item, depth + 1, seen)}`;
    });
    if (keys.length > MAX_ITEMS) parts.push(`…+${keys.length - MAX_ITEMS}`);
    return `{ ${parts.join(", ")} }`;
  } finally {
    seen.delete(value);
  }
}

function escapeField(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\t/g, "\\t")
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n");
}

/** 列内 tab/换行被转义，避免日志内容把 \t 分隔格式冲乱。 */
export function renderRecord(record: LogRecord): string {
  return [
    record.product,
    record.level,
    record.elapsedMs.toFixed(3),
    record.wallTime,
    escapeField(record.message),
  ].join("\t");
}

/** 全项目唯一的行分隔符：v1 的 get() 用 \r\n、上报用 \n，此处统一。 */
export function renderRecords(records: readonly LogRecord[]): string {
  return records.map(renderRecord).join("\n");
}
