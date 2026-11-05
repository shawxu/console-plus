import type { LocalLogStoreOptions, LogRecord, StoredBatch, StoredRecord } from "./types";

const DEFAULT_KEY = "console-plus:queue";
const DEFAULT_MAX_BYTES = 512 * 1024;

export function toStoredRecord(record: LogRecord): StoredRecord {
  return {
    s: record.seq,
    l: record.level,
    p: record.product,
    t: record.elapsedMs,
    w: record.wallTime,
    m: record.message,
  };
}

export function fromStoredRecord(stored: StoredRecord): LogRecord {
  return {
    seq: stored.s,
    level: stored.l,
    product: stored.p,
    elapsedMs: stored.t,
    wallTime: stored.w,
    args: [stored.m],
    message: stored.m,
  };
}

function isStoredBatch(value: unknown): value is StoredBatch {
  if (value === null || typeof value !== "object") return false;
  const candidate = value as Partial<StoredBatch>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.createdAt === "string" &&
    Array.isArray(candidate.records) &&
    candidate.records.every(
      (record: StoredRecord) =>
        record !== null &&
        typeof record === "object" &&
        typeof record.s === "number" &&
        typeof record.m === "string" &&
        typeof record.l === "string",
    )
  );
}

function estimatedBytes(batches: readonly StoredBatch[]): number {
  return JSON.stringify(batches).length * 2;
}

function resolveStorage(explicit?: Storage): Storage | null {
  const candidate = explicit ?? (typeof localStorage !== "undefined" ? localStorage : null);
  if (!candidate) return null;
  try {
    const probe = `${DEFAULT_KEY}:probe`;
    candidate.setItem(probe, "1");
    candidate.removeItem(probe);
    return candidate;
  } catch {
    // 隐私模式或 WebView 禁用存储
    return null;
  }
}

/**
 * localStorage 中的待上报队列。写入带体积上限与最旧批次淘汰，
 * 存储不可用时整体降级为「内存-only」，绝不抛给业务。
 */
export class LocalLogStore {
  readonly #key: string;
  readonly #maxBytes: number;
  readonly #storage: Storage | null;

  constructor(options: LocalLogStoreOptions = {}) {
    this.#key = options.key ?? DEFAULT_KEY;
    this.#maxBytes = Math.max(1024, options.maxBytes ?? DEFAULT_MAX_BYTES);
    this.#storage = resolveStorage(options.storage);
  }

  get available(): boolean {
    return this.#storage !== null;
  }

  read(): StoredBatch[] {
    if (!this.#storage) return [];
    try {
      const raw = this.#storage.getItem(this.#key);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter(isStoredBatch) : [];
    } catch {
      return [];
    }
  }

  /** 返回写入的批次；失败（配额/隐私模式）返回 null，调用方可稍后重试。 */
  append(records: readonly StoredRecord[]): StoredBatch | null {
    if (!this.#storage || records.length === 0) return null;
    const batch: StoredBatch = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
      createdAt: new Date().toISOString(),
      records,
    };
    try {
      this.#write([...this.read(), batch]);
      return batch;
    } catch {
      return null;
    }
  }

  /** 只移除已成功上报的 seq，同批次剩余级别继续保留。 */
  removeSent(batchId: string, sentSeqs: ReadonlySet<number>): void {
    if (!this.#storage || sentSeqs.size === 0) return;
    try {
      const next = this.read().flatMap((batch) => {
        if (batch.id !== batchId) return [batch];
        const remaining = batch.records.filter((record) => !sentSeqs.has(record.s));
        return remaining.length > 0 ? [{ ...batch, records: remaining }] : [];
      });
      this.#write(next);
    } catch {
      // 保留原状，下次上报重试
    }
  }

  clear(): void {
    if (!this.#storage) return;
    try {
      this.#storage.removeItem(this.#key);
    } catch {
      // 忽略
    }
  }

  #write(batches: StoredBatch[]): void {
    const storage = this.#storage;
    if (!storage) return;
    let next = batches;
    while (next.length > 1 && estimatedBytes(next) > this.#maxBytes) {
      next = next.slice(1);
    }
    try {
      storage.setItem(this.#key, JSON.stringify(next));
    } catch (error) {
      if (next.length > 1) {
        this.#write(next.slice(1));
        return;
      }
      throw error;
    }
  }
}
