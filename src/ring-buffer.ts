/**
 * 单一数据源的有界缓冲：v1 同时维护全量队列和 5 个分级队列并各自 shift()，
 * 裁剪不同步导致 get() 与 get('error') 对不上；这里 O(1) 写入，分级只是读取时的视图。
 */
export class RingBuffer<T> {
  readonly capacity: number;
  #items: (T | undefined)[];
  #start = 0;
  #size = 0;

  constructor(capacity: number) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new RangeError(
        `[console-plus] capacity must be a positive integer, got ${String(capacity)}`,
      );
    }
    this.capacity = capacity;
    this.#items = new Array<T | undefined>(capacity);
  }

  get size(): number {
    return this.#size;
  }

  /** 返回被淘汰的项（若已满）。 */
  push(item: T): T | undefined {
    let evicted: T | undefined;
    if (this.#size < this.capacity) {
      this.#items[(this.#start + this.#size) % this.capacity] = item;
      this.#size += 1;
    } else {
      evicted = this.#items[this.#start];
      this.#items[this.#start] = item;
      this.#start = (this.#start + 1) % this.capacity;
    }
    return evicted;
  }

  toArray(): T[] {
    const out: T[] = [];
    for (let i = 0; i < this.#size; i += 1) {
      const item = this.#items[(this.#start + i) % this.capacity];
      if (item !== undefined) out.push(item);
    }
    return out;
  }

  clear(): void {
    this.#items = new Array<T | undefined>(this.capacity);
    this.#start = 0;
    this.#size = 0;
  }

  /** 精确删除已成功上报的那一批，不误删未上报或上报期间新产生的日志。 */
  pruneWhere(predicate: (item: T) => boolean): number {
    const kept = this.toArray().filter((item) => !predicate(item));
    const removed = this.#size - kept.length;
    this.clear();
    for (const item of kept) this.push(item);
    return removed;
  }
}
