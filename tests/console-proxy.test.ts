import { describe, expect, it, vi } from "vitest";
import { ConsoleInterceptor } from "../src/console-proxy";
import type { ConsoleTarget } from "../src/console-proxy";
import { LOG_LEVELS } from "../src/levels";

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

describe("ConsoleInterceptor", () => {
  it("注入后既保留原生输出，也捕获日志", () => {
    const { target, calls } = fakeConsole();
    const captured: string[] = [];
    const interceptor = new ConsoleInterceptor({
      target,
      isSilent: () => false,
      capture: (level, args) => captured.push(`${level}:${String(args[0])}`),
    });

    expect(interceptor.inject()).toBe(true);
    (target["log"] as (...args: unknown[]) => void)("hello");

    expect(calls).toEqual(["log:hello"]);
    expect(captured).toEqual(["log:hello"]);
  });

  it("原生输出永远先于收集，且收集异常不冒泡", () => {
    const { target, calls } = fakeConsole();
    const order: string[] = [];
    const interceptor = new ConsoleInterceptor({
      target,
      isSilent: () => false,
      capture: () => {
        order.push("capture");
        throw new Error("collection failed");
      },
    });
    const original = target["info"] as (...args: unknown[]) => void;
    target["info"] = (...args: unknown[]) => {
      order.push("native");
      original(...args);
    };

    interceptor.inject();
    expect(() => (target["info"] as (...args: unknown[]) => void)("x")).not.toThrow();
    expect(order).toEqual(["native", "capture"]);
    expect(calls).toEqual(["info:x"]);
  });

  it("业务传入 Symbol 不会中断，也不会丢原生输出", () => {
    const { target, calls } = fakeConsole();
    const interceptor = new ConsoleInterceptor({
      target,
      isSilent: () => false,
      capture: (_level, args) => args.join(" "),
    });
    interceptor.inject();
    expect(() => (target["warn"] as (...args: unknown[]) => void)(Symbol("s"))).not.toThrow();
    expect(calls).toHaveLength(1);
  });

  it("静默模式抑制原生输出但仍收集", () => {
    const { target, calls } = fakeConsole();
    let silent = true;
    const captured: unknown[][] = [];
    const interceptor = new ConsoleInterceptor({
      target,
      isSilent: () => silent,
      capture: (_level, args) => captured.push(args),
    });
    interceptor.inject();
    (target["error"] as (...args: unknown[]) => void)("quiet");
    expect(calls).toEqual([]);
    expect(captured).toEqual([["quiet"]]);

    silent = false;
    interceptor.callNative("error", ["loud"]);
    expect(calls).toEqual(["error:loud"]);
  });

  it("inject 幂等，restore 完整恢复原引用", () => {
    const { target } = fakeConsole();
    const original = target["log"];
    const interceptor = new ConsoleInterceptor({
      target,
      isSilent: () => false,
      capture: () => {},
    });

    expect(interceptor.inject()).toBe(true);
    expect(interceptor.inject()).toBe(false);
    expect(target["log"]).not.toBe(original);
    expect(interceptor.restore()).toBe(true);
    expect(target["log"]).toBe(original);
    expect(interceptor.restore()).toBe(false);
  });

  it("外部 SDK 之后包装 console 时，restore 不覆盖它", () => {
    const { target } = fakeConsole();
    const originalLog = target["log"];
    const originalError = target["error"];
    const interceptor = new ConsoleInterceptor({
      target,
      isSilent: () => false,
      capture: () => {},
    });
    expect(interceptor.inject()).toBe(true);
    const ourProxy = target["log"];

    const external = () => {};
    target["log"] = external;

    expect(interceptor.restore()).toBe(false);
    expect(target["log"]).toBe(external);
    expect(target["error"]).toBe(originalError);
    expect(interceptor.injected).toBe(true);

    target["log"] = ourProxy;
    expect(interceptor.restore()).toBe(true);
    expect(target["log"]).toBe(originalLog);
  });

  it("原生 console 自身抛错也不影响业务", () => {
    const { target } = fakeConsole();
    target["log"] = () => {
      throw new Error("hostile console");
    };
    const interceptor = new ConsoleInterceptor({
      target,
      isSilent: () => false,
      capture: vi.fn(),
    });
    interceptor.inject();
    expect(() => (target["log"] as () => void)()).not.toThrow();
  });
});
