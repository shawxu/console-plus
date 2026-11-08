import { afterEach, describe, expect, it, vi } from "vitest";
import { createHttpReporter, normalizeParams, validateReportUrl } from "../src/reporters/http";
import type { ReportBatch } from "../src/types";

function makeBatch(overrides: Partial<ReportBatch> = {}): ReportBatch {
  return {
    product: "app",
    count: 2,
    text: "app\tinfo\t1.000\tt\tfirst\napp\terror\t2.000\tt\tsecond",
    records: [],
    params: { uid: "42" },
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** 显式声明参数，方便断言 RequestInit。 */
function fetchReturning(response: Response) {
  return vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => response);
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("validateReportUrl", () => {
  it("拒绝空值、非法 URL 与非 http(s) 协议", () => {
    expect(() => validateReportUrl("")).toThrow(TypeError);
    expect(() => validateReportUrl("http://")).toThrow(TypeError);
    expect(() => validateReportUrl("javascript:alert(1)")).toThrow(/protocol/i);
    expect(() => validateReportUrl("ftp://example.com/log")).toThrow(/protocol/i);
  });

  it("接受 http/https", () => {
    expect(validateReportUrl("https://example.com/log")).toContain("https://example.com/log");
    expect(validateReportUrl("http://localhost:3000/log")).toContain("http://localhost");
  });

  it("接受同源相对路径", () => {
    expect(validateReportUrl("/__collect")).toContain("/__collect");
    expect(validateReportUrl("__collect?fail=1")).toContain("__collect?fail=1");
    expect(() => validateReportUrl("javascript:alert(1)")).toThrow(/protocol/i);
  });
});

describe("normalizeParams", () => {
  it("统一转成字符串，并拒绝保留键与原型污染键", () => {
    const proto = Object.create({ inherited: "nope" }) as Record<string, unknown>;
    proto["uid"] = 7;
    proto["nested"] = { a: 1 };
    proto["log"] = "override";
    proto["__proto__"] = "polluted";
    proto["timing"] = "override";

    expect(normalizeParams(proto)).toEqual({ uid: "7", nested: '{"a":1}' });
    expect(({} as Record<string, unknown>)["polluted"]).toBeUndefined();
  });
});

describe("createHttpReporter（Web FormData）", () => {
  it("log / params 作为 FormData 同级字段，且不手写 Content-Type", async () => {
    const fetchMock = fetchReturning(jsonResponse({ code: 0 }));
    const result = await createHttpReporter({
      url: "https://example.com/log",
      fetch: fetchMock as unknown as typeof fetch,
      includeTiming: false,
    }).send(makeBatch({ params: { uid: "42", role: "admin" } }));

    expect(result).toMatchObject({ ok: true, sent: 2, attempts: 1 });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(init.headers).not.toHaveProperty("Content-Type");

    const form = init.body as FormData;
    expect(form).toBeInstanceOf(FormData);
    expect(form.get("log")).toContain("first");
    expect(form.get("uid")).toBe("42");
    expect(form.get("role")).toBe("admin");
  });

  it("204 / 空 body / 非 JSON 响应不抛异常", async () => {
    const responses = [
      new Response(null, { status: 204 }),
      new Response("ok", { status: 200 }),
      new Response("", { status: 200 }),
    ];
    for (const response of responses) {
      const fetchMock = fetchReturning(response);
      const result = await createHttpReporter({
        url: "https://example.com/log",
        fetch: fetchMock as unknown as typeof fetch,
        includeTiming: false,
      }).send(makeBatch());
      expect(result.ok).toBe(true);
      expect(result.sent).toBe(2);
    }
  });

  it("服务端 code !== 0 或非 2xx 视为失败", async () => {
    for (const response of [jsonResponse({ code: 500 }), jsonResponse({ code: 0 }, 503)]) {
      const fetchMock = fetchReturning(response);
      const result = await createHttpReporter({
        url: "https://example.com/log",
        fetch: fetchMock as unknown as typeof fetch,
        includeTiming: false,
      }).send(makeBatch());
      expect(result.ok).toBe(false);
      expect(result.error).toBeTruthy();
    }
  });

  it("支持自定义 isSuccess", async () => {
    const fetchMock = fetchReturning(jsonResponse({ accepted: true }));
    const result = await createHttpReporter({
      url: "https://example.com/log",
      fetch: fetchMock as unknown as typeof fetch,
      includeTiming: false,
      isSuccess: (_response, payload) => (payload as { accepted?: boolean })?.accepted === true,
    }).send(makeBatch());
    expect(result.ok).toBe(true);
  });

  it("超时后返回失败且清理定时器", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        }),
    );
    const pending = createHttpReporter({
      url: "https://example.com/log",
      timeoutMs: 100,
      fetch: fetchMock as unknown as typeof fetch,
      includeTiming: false,
    }).send(makeBatch());

    await vi.advanceTimersByTimeAsync(100);
    const result = await pending;
    expect(result.ok).toBe(false);
    expect(result.error).toContain("abort");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("fetch 同步抛错时同样清理定时器并按需重试", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(() => {
      throw new Error("sync boom");
    });
    const pending = createHttpReporter({
      url: "https://example.com/log",
      retries: 1,
      retryDelayMs: 10,
      fetch: fetchMock as unknown as typeof fetch,
      includeTiming: false,
    }).send(makeBatch());

    await vi.runAllTimersAsync();
    const result = await pending;
    expect(result.ok).toBe(false);
    expect(result.attempts).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });
});
