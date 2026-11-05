import { describe, expect, it } from "vitest";
import { formatArgs, renderRecord, renderRecords, serializeArg } from "../src/serialize";
import type { LogRecord } from "../src/types";

describe("serializeArg", () => {
  it("安全处理 Symbol、BigInt、函数与循环引用", () => {
    expect(serializeArg(Symbol("tag"))).toBe("Symbol(tag)");
    expect(serializeArg(10n)).toBe("10n");
    expect(serializeArg(function named() {})).toContain("named");
    expect(serializeArg(undefined)).toBe("undefined");
    expect(serializeArg(null)).toBe("null");

    const cyclic: Record<string, unknown> = { name: "root" };
    cyclic["self"] = cyclic;
    expect(serializeArg(cyclic)).toContain("[Circular]");
  });

  it("保留 Error 的 stack，对象不再退化成 [object Object]", () => {
    const error = new Error("boom");
    expect(serializeArg(error)).toContain("Error: boom");
    expect(serializeArg({ a: 1, b: "two" })).toBe("{ a: 1, b: two }");
    expect(serializeArg(new Map([["k", 1]]))).toContain("k => 1");
  });

  it("getter 抛错时降级而不是冒泡", () => {
    const hostile: Record<string, unknown> = {};
    Object.defineProperty(hostile, "x", {
      enumerable: true,
      get() {
        throw new Error("getter exploded");
      },
    });
    expect(serializeArg(hostile)).toBe("[Unserializable]");
  });

  it("对深度、条目数和字符串长度设上限", () => {
    const deep = { a: { b: { c: { d: { e: { f: 1 } } } } } };
    expect(serializeArg(deep)).toContain("[…]");
    expect(serializeArg(Array.from({ length: 30 }, (_, i) => i))).toContain("+10");
    expect(serializeArg("x".repeat(3000))).toContain("[truncated]");
  });

  it("formatArgs 对每个参数独立序列化", () => {
    expect(formatArgs(["a", Symbol("s"), { k: 1 }])).toEqual(["a", "Symbol(s)", "{ k: 1 }"]);
  });
});

describe("renderRecord", () => {
  const base: LogRecord = {
    seq: 1,
    level: "error",
    product: "app",
    elapsedMs: 12.3456,
    wallTime: "2026-01-01T00:00:00.000Z",
    args: ["oops\tmore\nline"],
    message: "oops\tmore\nline",
  };

  it("列内 tab/换行/反斜杠被转义，不会冲乱 \\t 分隔格式", () => {
    const line = renderRecord(base);
    expect(line.split("\t")).toHaveLength(5);
    expect(line).toContain("oops\\tmore\\nline");
    expect(line.startsWith("app\terror\t12.346\t")).toBe(true);
  });

  it("所有渲染统一使用 \\n 作为行分隔符", () => {
    const text = renderRecords([base, { ...base, seq: 2 }]);
    expect(text.split("\n")).toHaveLength(2);
    expect(text).not.toContain("\r");
  });
});
