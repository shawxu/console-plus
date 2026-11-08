import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConsoleTarget } from "../src/console-proxy";
import { LOG_LEVELS } from "../src/levels";
import type { ConsolePlus } from "../src/logger";
import { createConsolePlus, createWebConsolePlus } from "../src/logger";
import { fromStoredRecord, LocalLogStore, toStoredRecord } from "../src/persistence";
import type { PersistenceSettings, Reporter, StoredRecord } from "../src/types";

const fixedClock = {
  now: () => 12.3456,
  wallTime: () => "2026-01-01T00:00:00.000Z",
};

function fakeConsole(): ConsoleTarget {
  const target = {} as ConsoleTarget;
  for (const level of LOG_LEVELS) target[level] = () => {};
  return target;
}

const instances: ConsolePlus[] = [];

function make(settings: PersistenceSettings = {}): ConsolePlus {
  const cp = createWebConsolePlus({
    target: fakeConsole(),
    clock: fixedClock,
    persistence: {
      flushThreshold: 1000,
      flushIntervalMs: 100_000,
      watchPageHide: false,
      ...settings,
    },
  });
  instances.push(cp);
  return cp;
}

function okReporter(): Reporter {
  return {
    send: vi.fn(async (batch) => ({ ok: true, sent: batch.count, attempts: 1 })),
  };
}

function sampleRecord(seq: number, level: "info" | "error" = "info"): StoredRecord {
  return {
    s: seq,
    l: level,
    p: "app",
    t: 1.5,
    w: "2026-01-01T00:00:00.000Z",
    m: `message-${seq}`,
  };
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  for (const cp of instances) cp.dispose();
  instances.length = 0;
  vi.useRealTimers();
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => "visible",
  });
  window.localStorage.clear();
});

describe("LocalLogStore", () => {
  it("append / read / clear 往返", () => {
    const store = new LocalLogStore();
    expect(store.available).toBe(true);
    expect(store.read()).toEqual([]);
    expect(store.append([sampleRecord(1), sampleRecord(2)]))?.toHaveProperty("records.length", 2);
    expect(store.read()[0]?.records.map((record) => record.m)).toEqual(["message-1", "message-2"]);
    store.clear();
    expect(store.read()).toEqual([]);
  });

  it("removeSent 只删已上报的 seq，剩余记录留在原批次", () => {
    const store = new LocalLogStore();
    const batch = store.append([
      sampleRecord(1, "error"),
      sampleRecord(2),
      sampleRecord(3, "error"),
    ]);
    expect(batch).not.toBeNull();
    store.removeSent(batch!.id, new Set([1, 3]));
    expect(store.read()[0]?.records.map((record) => record.s)).toEqual([2]);
    store.removeSent(batch!.id, new Set([2]));
    expect(store.read()).toEqual([]);
  });

  it("超过体积上限时淘汰最旧批次", () => {
    const store = new LocalLogStore({ maxBytes: 1024 });
    for (let i = 0; i < 12; i += 1) {
      store.append(Array.from({ length: 5 }, (_, j) => sampleRecord(i * 10 + j)));
    }
    const batches = store.read();
    expect(batches.length).toBeLessThan(12);
    expect(batches.length).toBeGreaterThan(0);
    expect(batches[batches.length - 1]?.records[0]?.m).toContain("11");
  });

  it("存储内容损坏或结构非法时安全忽略", () => {
    window.localStorage.setItem("console-plus:queue", "{not json");
    expect(new LocalLogStore().read()).toEqual([]);
    window.localStorage.setItem(
      "console-plus:queue",
      JSON.stringify([{ id: 1 }, { id: "x", createdAt: "t", records: [null] }]),
    );
    expect(new LocalLogStore().read()).toEqual([]);
  });

  it("存储不可用时 available=false，append 返回 null", () => {
    const broken = {
      setItem: () => {
        throw new Error("SecurityError");
      },
      getItem: () => null,
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    } as unknown as Storage;
    const store = new LocalLogStore({ storage: broken });
    expect(store.available).toBe(false);
    expect(store.append([sampleRecord(1)])).toBeNull();
    expect(store.read()).toEqual([]);
  });

  it("记录转换保留级别与消息", () => {
    const restored = fromStoredRecord(
      toStoredRecord({
        seq: 7,
        level: "warn",
        product: "app",
        elapsedMs: 3.2,
        wallTime: "t",
        args: ["a"],
        message: "a",
      }),
    );
    expect(restored).toMatchObject({ seq: 7, level: "warn", message: "a", args: ["a"] });
  });
});

describe("flush 触发器", () => {
  it("内存中未持久化日志达到阈值即 flush", () => {
    const cp = make({ flushThreshold: 3 });
    expect(cp.persisted).toBe(true);
    cp.info("a");
    cp.info("b");
    expect(new LocalLogStore().read()).toHaveLength(0);
    cp.info("c");
    expect(new LocalLogStore().read()[0]?.records).toHaveLength(3);
  });

  it("达到时长后定时 flush", () => {
    vi.useFakeTimers();
    const cp = make({ flushIntervalMs: 100 });
    cp.info("timed");
    expect(new LocalLogStore().read()).toHaveLength(0);
    vi.advanceTimersByTime(100);
    expect(new LocalLogStore().read()[0]?.records).toHaveLength(1);
  });

  it("pagehide 时同步 flush", () => {
    const cp = make({ watchPageHide: true });
    cp.info("leaving");
    window.dispatchEvent(new Event("pagehide"));
    expect(new LocalLogStore().read()[0]?.records[0]?.m).toBe("leaving");
  });

  it("页面隐藏时 flush", () => {
    const cp = make({ watchPageHide: true });
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    cp.info("background");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(new LocalLogStore().read()[0]?.records[0]?.m).toBe("background");
  });

  it("flush 幂等，clear 同时清空本地队列", () => {
    const cp = make();
    cp.info("x");
    expect(cp.flush()).toBe(1);
    expect(cp.flush()).toBe(0);
    expect(new LocalLogStore().read()).toHaveLength(1);
    cp.clear();
    expect(new LocalLogStore().read()).toEqual([]);
  });

  it("clear 之后条数阈值重新计数", () => {
    const cp = make({ flushThreshold: 3 });
    cp.info("a");
    cp.info("b");
    expect(new LocalLogStore().read()).toHaveLength(0);
    cp.clear();
    cp.info("c");
    expect(new LocalLogStore().read()).toHaveLength(0);
    cp.info("d");
    cp.info("e");
    expect(new LocalLogStore().read()[0]?.records).toHaveLength(3);
  });

  it("dispose 会卸载定时器与页面监听", () => {
    const cp = make({ watchPageHide: true });
    cp.info("before dispose");
    cp.dispose();
    window.localStorage.clear();
    window.dispatchEvent(new Event("pagehide"));
    expect(new LocalLogStore().read()).toEqual([]);
  });
});

describe("历史批次回传", () => {
  it("新实例能回传上一次会话遗留的日志，成功后本地与内存都清除", async () => {
    const previous = make();
    previous.info("from previous page");
    previous.flush();
    expect(new LocalLogStore().read()).toHaveLength(1);

    const reporter = okReporter();
    const current = make();
    current.setReporter(reporter);
    const result = await current.report();

    expect(result).toMatchObject({ ok: true, sent: 1, batches: 1, failed: 0 });
    expect(reporter.send).toHaveBeenCalledTimes(1);
    expect(new LocalLogStore().read()).toEqual([]);
    expect(current.size).toBe(0);
  });

  it("上报失败时保留本地批次，下次可重试", async () => {
    const cp = make();
    cp.info("keep me");
    cp.setReporter({
      async send() {
        return { ok: false, sent: 0, attempts: 1, error: "offline" };
      },
    });
    const result = await cp.report();
    expect(result.ok).toBe(false);
    expect(result.error).toContain("offline");
    expect(new LocalLogStore().read()).toHaveLength(1);
  });

  it("按级别上报时，其他级别继续留在本地", async () => {
    const cp = make();
    cp.info("info-1");
    cp.error("error-1");
    cp.flush();
    cp.setReporter(okReporter());

    const result = await cp.report({ level: "error" });
    expect(result).toMatchObject({ ok: true, sent: 1 });
    const remaining = new LocalLogStore().read();
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.records.map((record) => record.l)).toEqual(["info"]);
  });

  it("存储不可用时退化为内存直报", async () => {
    const broken = {
      setItem: () => {
        throw new Error("denied");
      },
      getItem: () => null,
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    } as unknown as Storage;
    const cp = createWebConsolePlus({
      target: fakeConsole(),
      clock: fixedClock,
      persistence: { storage: broken },
    });
    instances.push(cp);
    expect(cp.persisted).toBe(false);
    cp.setReporter(okReporter());
    cp.info("memory only");
    const result = await cp.report();
    expect(result).toMatchObject({ ok: true, sent: 1 });
    expect(cp.size).toBe(0);
  });

  it("persistence 默认关闭，导入默认实例无副作用", () => {
    const cp = createConsolePlus({ target: fakeConsole(), clock: fixedClock });
    instances.push(cp);
    expect(cp.persisted).toBe(false);
    cp.info("x");
    expect(cp.flush()).toBe(0);
    expect(new LocalLogStore().read()).toEqual([]);
  });
});
