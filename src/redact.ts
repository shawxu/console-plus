import type { Redactor, ReportBatch } from "./types";

const SENSITIVE_KEY =
  /^(?:authorization|bearer|token|access[_-]?token|refresh[_-]?token|password|passwd|pwd|secret|client[_-]?secret|api[_-]?key|access[_-]?key|cookie|set-cookie|session[_-]?id|credit[_-]?card)$/i;
const ASSIGNMENT = /([A-Za-z0-9_-]+)\s*[:=]\s*("[^"]*"|'[^']*'|[^\s,;&)}\]]+)/g;
const JWT = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;

/** 仅用于上报数据；内存记录与控制台输出保持原样。 */
export function redactText(text: string): string {
  return text
    .replace(ASSIGNMENT, (match, key: string) =>
      SENSITIVE_KEY.test(key) ? match.replace(/[:=]\s*.*$/, ": [REDACTED]") : match,
    )
    .replace(JWT, "[REDACTED]");
}

function defaultRedactor(batch: ReportBatch): ReportBatch {
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(batch.params)) {
    params[key] = SENSITIVE_KEY.test(key) ? "[REDACTED]" : redactText(value);
  }
  return {
    ...batch,
    text: redactText(batch.text),
    records: batch.records.map((record) => ({
      ...record,
      message: redactText(record.message),
      args: record.args.map(redactText),
    })),
    params,
  };
}

export function resolveRedactor(option: boolean | Redactor | undefined): Redactor | null {
  if (option === false) return null;
  if (typeof option === "function") return option;
  return defaultRedactor;
}
