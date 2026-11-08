import { describe, expect, it, vi } from "vitest";
import type { ConsoleTarget } from "../src/console-proxy";
import { LOG_LEVELS } from "../src/levels";
import { createConsolePlus } from "../src/logger";
import { redactText } from "../src/redact";
import type { Reporter } from "../src/types";

const fixedClock = {
  now: () => 12.3456,
  wallTime: () => "2026-01-01T00:00:00.000Z",
};

function fakeConsole(): { target: ConsoleTarget; calls: string[] } {
  const calls: string[] = [];
  const target = {} as ConsoleTarget;
  for (const level of LOG_LEVELS) {
    target[level] = (...args: unknown[]) => {
      calls.push(`${level}:${args.map(String).join(" ")}`);
    };
  }
  return { target, calls };
}

function setup() {
  const { target, calls } = fakeConsole();
  const cp = createConsolePlus({ target, clock: fixedClock, silentMode: false });
  return { cp, target, calls };
}

function okReporter(): Reporter {
  return { send: vi.fn(async (batch) => ({ ok: true, sent: batch.count, attempts: 1 })) };
}

describe("ConsolePlus 配置", () => {
  it("config 只合并传入字段，不会重置 silentMode", () => {
    const { cp, calls } = setup();
    cp.config({ silentMode: true, productName: "first", reportUrl: "https://a.test/log" });
    cp.config({ productName: "second" });

    expect(cp.settings).toEqual({
      productName: "second",
      silentMode: true,
      reportUrl: "https://a.test/log",
      maxEntries: 10000,
    });
    cp.info("quiet");
    expect(calls).toEqual([]);
    expect(cp.size).toBe(1);
  });

  it("校验非法配置", () => {
    const { cp } = setup();
    expect(() => cp.config({ productName: "" })).toThrow(TypeError);
    expect(() => cp.config({ maxEntries: 0 })).toThrow(RangeError);
    expect(() => createConsolePlus({ maxEntries: -1 })).toThrow(RangeError);
  });

  it("调整容量时保留最近的记录", () => {
    const { cp } = setup();
    cp.info("a");
    cp.info("b");
    cp.info("c");
    cp.config({ maxEntries: 2 });
    expect(cp.get().split("\n")).toHaveLength(2);
    expect(cp.get()).not.toContain("\ta\t");
  });
});

describe("ConsolePlus 采集与读取", () => {
  it("记录是结构化的，且 get 与分级视图同源", () => {
    const { cp } = setup();
    cp.info("hello", 60);
    cp.error("oops");

    const record = cp.records()[0];
    expect(record).toMatchObject({
      seq: 1,
      level: "info",
      product: "console-plus",
      elapsedMs: 12.3456,
      wallTime: "2026-01-01T00:00:00.000Z",
      message: "hello 60",
    });
    expect(cp.get("error")).toBe(cp.get().split("\n")[1]);
    expect(cp.records({ level: "error" })).toHaveLength(1);
  });

  it("非法级别显式抛错，绝不静默回落全量", () => {
    const { cp } = setup();
    cp.info("a");
    cp.error("b");
    // @ts-expect-error 运行时才可能出现的非法值
    expect(() => cp.get("trace")).toThrow(TypeError);
    // @ts-expect-error 验证运行时对非法级别的防护
    expect(() => cp.records({ level: "trace" })).toThrow(TypeError);
  });

  it("上限裁剪后全量与分级结果始终一致", () => {
    const { target } = fakeConsole();
    const cp = createConsolePlus({ target, clock: fixedClock, maxEntries: 3 });
    for (let i = 0; i < 6; i += 1) cp[i % 2 === 0 ? "info" : "error"](`msg-${i}`);
    const all = cp.get().split("\n");
    expect(all).toHaveLength(3);
    expect(
      cp
        .get("info")
        .split("\n")
        .every((line) => all.includes(line)),
    ).toBe(true);
    expect(
      cp
        .get("error")
        .split("\n")
        .every((line) => all.includes(line)),
    ).toBe(true);
  });

  it("clear 只清队列，可选清控制台", () => {
    const { cp } = setup();
    cp.info("x");
    cp.clear();
    expect(cp.size).toBe(0);
    expect(cp.get()).toBe("");

    const spy = vi.spyOn(console, "clear").mockImplementation(() => {});
    try {
      cp.info("y");
      cp.clear({ console: true });
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
    expect(cp.size).toBe(0);
  });
});

describe("ConsolePlus 注入", () => {
  it("inject 后原生 console 输出被捕获，restore 后不再捕获", () => {
    const { cp, target, calls } = setup();
    expect(cp.inject()).toBe(true);
    (target["log"] as (...args: unknown[]) => void)("via console");
    expect(cp.get()).toContain("via console");
    expect(calls).toHaveLength(1);

    expect(cp.restore()).toBe(true);
    (target["log"] as (...args: unknown[]) => void)("after restore");
    expect(cp.get()).not.toContain("after restore");
  });

  it("Symbol 参数不会中断业务调用", () => {
    const { cp, target } = setup();
    cp.inject();
    expect(() => (target["log"] as (...args: unknown[]) => void)(Symbol("s"))).not.toThrow();
    expect(cp.size).toBe(1);
  });
});

describe("ConsolePlus 上报", () => {
  it("返回真实结果，且成功后只清已发送的那一批", async () => {
    const { cp } = setup();
    const reporter = okReporter();
    cp.setReporter(reporter);
    cp.info("a");
    cp.error("b");

    const result = await cp.report({ params: { uid: 123 } });
    expect(result).toMatchObject({ ok: true, sent: 2, attempts: 1 });
    expect(cp.size).toBe(0);
    expect(reporter.send).toHaveBeenCalledTimes(1);
    const batch = vi.mocked(reporter.send).mock.calls[0]?.[0];
    expect(batch?.params).toEqual({ uid: "123" });
    expect(batch?.text).toContain("a");
  });

  it("按级别上报时只清理该级别，未上报的日志保留", async () => {
    const { cp } = setup();
    cp.info("info-1");
    cp.error("error-1");
    cp.info("info-2");
    cp.setReporter(okReporter());

    const result = await cp.report({ level: "error" });
    expect(result.sent).toBe(1);
    expect(cp.records().map((record) => record.level)).toEqual(["info", "info"]);
    expect(cp.get()).toContain("info-1");
    expect(cp.get()).toContain("info-2");
    expect(cp.get()).not.toContain("error-1");
  });

  it("上报期间产生的新日志不会被误删", async () => {
    const { cp } = setup();
    const late = () => cp.info("new");
    cp.setReporter({
      async send() {
        late();
        return { ok: true, sent: 1, attempts: 1 };
      },
    });
    cp.info("old");

    await cp.report();
    expect(cp.get()).toContain("new");
    expect(cp.get()).not.toContain("old");
  });

  it("失败时保留队列，且不抛给调用方", async () => {
    const { cp } = setup();
    cp.setReporter({
      async send() {
        throw new Error("network down");
      },
    });
    cp.info("keep me");
    const result = await cp.report();
    expect(result.ok).toBe(false);
    expect(result.error).toContain("network down");
    expect(cp.size).toBe(1);
  });

  it("未配置 reporter 时给出明确错误；空队列直接成功", async () => {
    const { cp } = setup();
    await expect(cp.report()).rejects.toThrow(/No reporter configured/);
    cp.setReporter(okReporter());
    expect(await cp.report()).toMatchObject({ ok: true, sent: 0 });
    cp.info("x");
    // @ts-expect-error 非法级别
    await expect(cp.report({ level: "trace" })).rejects.toThrow(TypeError);
  });

  it("默认脱敏只作用于上报数据，不改动内存记录", async () => {
    const { cp } = setup();
    const reporter = okReporter();
    cp.setReporter(reporter);
    cp.info("token=abc123");

    await cp.report({ clear: false });
    const batch = vi.mocked(reporter.send).mock.calls[0]?.[0];
    expect(batch?.text).toContain("[REDACTED]");
    expect(cp.records()[0]?.message).toBe("token=abc123");
  });

  it("自定义脱敏抛错时拒绝发送", async () => {
    const { target } = fakeConsole();
    const cp = createConsolePlus({
      target,
      clock: fixedClock,
      redact: () => {
        throw new Error("bad redactor");
      },
    });
    cp.setReporter(okReporter());
    cp.info("sensitive");
    const result = await cp.report();
    expect(result.ok).toBe(false);
    expect(result.error).toContain("report aborted");
    expect(cp.size).toBe(1);
  });

  it("可关闭脱敏", async () => {
    expect(redactText("token=abc123")).toContain("[REDACTED]");
    const { target } = fakeConsole();
    const cp = createConsolePlus({ target, clock: fixedClock, redact: false });
    const reporter = okReporter();
    cp.setReporter(reporter);
    cp.info("token=abc123");
    await cp.report({ clear: false });
    const batch = vi.mocked(reporter.send).mock.calls[0]?.[0];
    expect(batch?.text).toContain("token=abc123");
    expect(cp.size).toBe(1);
  });
});

describe("ConsolePlus 生命周期", () => {
  it("dispose 恢复 console 并停止收集", () => {
    const { cp, target } = setup();
    cp.inject();
    cp.dispose();
    expect(cp.disposed).toBe(true);
    expect(cp.injected).toBe(false);
    expect(cp.size).toBe(0);
    (target["log"] as (...args: unknown[]) => void)("ignored");
    cp.info("also ignored");
    expect(cp.size).toBe(0);
  });
});
