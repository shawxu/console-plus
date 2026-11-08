import type { ReportBatch, ReportResult, Reporter } from "../types";

export interface HttpReporterOptions {
  /** 必填，仅允许 http/https */
  url: string;
  timeoutMs?: number;
  /** 失败重试次数，默认 0 */
  retries?: number;
  retryDelayMs?: number;
  headers?: Readonly<Record<string, string>>;
  /** 默认 2xx 且 body 的 code === 0 / success === true / 无 body */
  isSuccess?: (response: Response, payload: unknown) => boolean;
  /** 可注入 fetch，便于测试或被客户端拦截的 WebView 自行实现 */
  fetch?: typeof fetch;
  /** 是否附带 navigation timing，默认 true */
  includeTiming?: boolean;
}

const RESERVED_KEYS = new Set(["__proto__", "constructor", "prototype", "timing"]);

export function normalizeParams(
  input: Readonly<Record<string, unknown>> | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!input) return out;
  for (const key of Object.keys(input)) {
    if (RESERVED_KEYS.has(key) || key.toLowerCase() === "log") continue;
    const value = input[key];
    if (value === undefined || value === null) continue;
    out[key] = typeof value === "string" ? value : stringify(value);
  }
  return out;
}

function stringify(value: unknown): string {
  try {
    return typeof value === "object" ? (JSON.stringify(value) ?? "null") : String(value);
  } catch {
    return "[Unserializable]";
  }
}

export function validateReportUrl(raw: string): string {
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new TypeError("[console-plus] reportUrl is required before reporting logs.");
  }
  let parsed: URL;
  try {
    // 浏览器里同源相对路径（如 /collect）很常见，用当前页面地址作 base 解析
    const base = typeof window !== "undefined" ? window.location.href : undefined;
    parsed = new URL(raw, base);
  } catch {
    throw new TypeError(`[console-plus] Invalid reportUrl: ${raw}`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new TypeError(`[console-plus] Unsupported reportUrl protocol: ${parsed.protocol}`);
  }
  return parsed.toString();
}

function readNavigationTiming(): Record<string, unknown> | undefined {
  const [entry] = performance.getEntriesByType?.("navigation") ?? [];
  return (entry as PerformanceNavigationTiming | undefined)?.toJSON();
}

/** 统一 FormData：multipart/form-data 是 CORS simple request，不触发额外预检。 */
function buildPayload(
  batch: ReportBatch,
  includeTiming: boolean,
  extraHeaders?: Readonly<Record<string, string>>,
): { body: FormData; headers: Record<string, string> } {
  const form = new FormData();
  form.append("log", batch.text);
  const timing = includeTiming ? (batch.timing ?? readNavigationTiming()) : undefined;
  if (timing) form.append("timing", JSON.stringify(timing));
  for (const [key, value] of Object.entries(batch.params)) form.append(key, value);
  return { body: form, headers: { ...extraHeaders } };
}

/** 204 / 空 body / 非 JSON 响应都不再让上报链抛异常。 */
async function readPayload(response: Response): Promise<unknown> {
  if (response.status === 204 || response.status === 205) return undefined;
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function defaultIsSuccess(response: Response, payload: unknown): boolean {
  if (!response.ok) return false;
  if (payload === null || payload === undefined || typeof payload === "string") return true;
  if (typeof payload === "object") {
    const body = payload as Record<string, unknown>;
    if ("code" in body) return body["code"] === 0;
    if ("success" in body) return body["success"] === true;
  }
  return true;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createHttpReporter(options: HttpReporterOptions): Reporter {
  const url = validateReportUrl(options.url);
  const timeoutMs = options.timeoutMs ?? 3000;
  const retries = Math.max(0, options.retries ?? 0);
  const retryDelayMs = options.retryDelayMs ?? 300;
  const includeTiming = options.includeTiming ?? true;
  const isSuccess = options.isSuccess ?? defaultIsSuccess;
  const fetchImpl = options.fetch ?? fetch;

  return {
    async send(batch: ReportBatch): Promise<ReportResult> {
      let lastError = "Unknown error";
      const total = retries + 1;

      for (let attempt = 1; attempt <= total; attempt += 1) {
        const controller = new AbortController();
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          const { body, headers } = buildPayload(batch, includeTiming, options.headers);
          timer = setTimeout(() => controller.abort(), timeoutMs);

          const init = {
            method: "POST",
            mode: "cors",
            priority: "low",
            signal: controller.signal,
            headers,
            body,
          } as RequestInit;
          const response = await fetchImpl(url, init);
          const payload = await readPayload(response);

          if (!isSuccess(response, payload)) {
            return {
              ok: false,
              sent: 0,
              attempts: attempt,
              status: response.status,
              error: `Server rejected the report (HTTP ${response.status}).`,
            };
          }
          return { ok: true, sent: batch.count, attempts: attempt, status: response.status };
        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error);
          if (attempt < total) await delay(retryDelayMs * 2 ** (attempt - 1));
        } finally {
          if (timer !== undefined) clearTimeout(timer);
        }
      }

      return { ok: false, sent: 0, attempts: total, error: lastError };
    },
  };
}
