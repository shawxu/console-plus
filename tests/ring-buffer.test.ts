import { describe, expect, it } from "vitest";
import { RingBuffer } from "../src/ring-buffer";

describe("RingBuffer", () => {
  it("拒绝非法容量", () => {
    expect(() => new RingBuffer(0)).toThrow(RangeError);
    expect(() => new RingBuffer(1.5)).toThrow(RangeError);
  });

  it("保持写入顺序并在满时淘汰最旧项", () => {
    const buffer = new RingBuffer<number>(3);
    expect(buffer.push(1)).toBeUndefined();
    buffer.push(2);
    buffer.push(3);
    expect(buffer.toArray()).toEqual([1, 2, 3]);
    expect(buffer.push(4)).toBe(1);
    expect(buffer.toArray()).toEqual([2, 3, 4]);
    expect(buffer.size).toBe(3);
  });

  it("多次环绕后仍然有序", () => {
    const buffer = new RingBuffer<number>(3);
    for (let i = 1; i <= 10; i += 1) buffer.push(i);
    expect(buffer.toArray()).toEqual([8, 9, 10]);
  });

  it("clear 重置状态", () => {
    const buffer = new RingBuffer<number>(2);
    buffer.push(1);
    buffer.clear();
    expect(buffer.size).toBe(0);
    expect(buffer.toArray()).toEqual([]);
    buffer.push(7);
    expect(buffer.toArray()).toEqual([7]);
  });

  it("pruneWhere 精确删除已上报记录并保留其余", () => {
    const buffer = new RingBuffer<{ seq: number; level: string }>(10);
    buffer.push({ seq: 1, level: "error" });
    buffer.push({ seq: 2, level: "info" });
    buffer.push({ seq: 3, level: "error" });
    buffer.push({ seq: 4, level: "info" });
    const sent = new Set([1, 3]);
    expect(buffer.pruneWhere((item) => sent.has(item.seq))).toBe(2);
    expect(buffer.toArray().map((item) => item.seq)).toEqual([2, 4]);
  });
});
