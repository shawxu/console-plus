import { ConsoleInterceptor } from "./console-proxy";
import type { ConsoleTarget } from "./console-proxy";
import { assertLogLevel } from "./levels";
import type { LogLevel } from "./levels";
import { fromStoredRecord, LocalLogStore, toStoredRecord } from "./persistence";
import { resolveRedactor } from "./redact";
import { RingBuffer } from "./ring-buffer";
import { createHttpReporter, normalizeParams } from "./reporters/http";
import { formatArgs, renderRecords } from "./serialize";
import { createClock } from "./time";
import type {
  ClearOptions,
  Clock,
  ConfigPatch,
  ConsolePlusConfig,
  ConsolePlusOptions,
  LogRecord,
  PersistenceSettings,
  ReadOptions,
  ReportBatch,
  ReportOptions,
  ReportResult,
  Reporter,
} from "./types";

const DEFAULT_PRODUCT = "console-plus";
const DEFAULT_MAX_ENTRIES = 10000;
const DEFAULT_FLUSH_THRESHOLD = 200;
const DEFAULT_FLUSH_INTERVAL_MS = 10_000;

interface ResolvedPersistence {
  store: LocalLogStore;
  flushThreshold: number;
}

/** target 用于把宿主 console 换成沙箱对象，主要服务于测试与嵌入环境。 */
export interface ConsolePlusFactoryOptions extends ConsolePlusOptions {
  target?: ConsoleTarget;
}

function assertCapacity(value: number): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(
      `[console-plus] maxEntries must be a positive integer, got ${String(value)}`,
    );
  }
}

export class ConsolePlus {
  readonly #clock: Clock;
  readonly #interceptor: ConsoleInterceptor;
  #config: ConsolePlusConfig;
  #buffer: RingBuffer<LogRecord>;
  #reporter: Reporter | null;
  #reporterIsDefault = false;
  #redact: ReturnType<typeof resolveRedactor>;
  #seq = 0;
  #disposed = false;
  #persistence: ResolvedPersistence | null = null;
  #lastFlushedSeq = 0;
  #flushTimer: ReturnType<typeof setInterval> | undefined;
  #onPageHide: (() => void) | undefined;
  #onVisibility: (() => void) | undefined;
  #flushing = false;

  readonly log = (...args: unknown[]): void => this.#emit("log", args);
  readonly info = (...args: unknown[]): void => this.#emit("info", args);
  readonly debug = (...args: unknown[]): void => this.#emit("debug", args);
  readonly warn = (...args: unknown[]): void => this.#emit("warn", args);
  readonly error = (...args: unknown[]): void => this.#emit("error", args);

  constructor(options: ConsolePlusFactoryOptions = {}) {
    this.#config = {
      productName: options.productName ?? DEFAULT_PRODUCT,
      maxEntries: options.maxEntries ?? DEFAULT_MAX_ENTRIES,
      silentMode: options.silentMode ?? false,
      reportUrl: options.reportUrl ?? "",
    };
    assertCapacity(this.#config.maxEntries);

    this.#clock = options.clock ?? createClock();
    this.#buffer = new RingBuffer<LogRecord>(this.#config.maxEntries);
    this.#redact = resolveRedactor(options.redact);
    this.#interceptor = new ConsoleInterceptor({
      capture: (level, args) => this.#capture(level, args),
      isSilent: () => this.#config.silentMode,
      ...(options.target ? { target: options.target } : {}),
    });

    if (options.reporter) {
      this.#reporter = options.reporter;
    } else if (this.#config.reportUrl) {
      this.#reporter = createHttpReporter({ url: this.#config.reportUrl });
      this.#reporterIsDefault = true;
    } else {
      this.#reporter = null;
    }

    if (options.persistence) {
      this.#setupPersistence(options.persistence === true ? {} : options.persistence);
    }
    if (options.autoInject) this.#interceptor.inject();
  }

  get settings(): ConsolePlusConfig {
    return { ...this.#config };
  }

  get size(): number {
    return this.#buffer.size;
  }

  get injected(): boolean {
    return this.#interceptor.injected;
  }

  get disposed(): boolean {
    return this.#disposed;
  }

  /** 是否启用了可用的本地持久化。 */
  get persisted(): boolean {
    return this.#persistence !== null;
  }

  /** 把内存中尚未持久化的日志写入 localStorage，返回写入条数。 */
  flush(): number {
    const store = this.#persistence?.store;
    if (!store || this.#flushing) return 0;
    this.#flushing = true;
    try {
      const pending = this.#buffer.toArray().filter((record) => record.seq > this.#lastFlushedSeq);
      if (pending.length === 0) return 0;
      if (!store.append(pending.map(toStoredRecord))) return 0;
      const last = pending[pending.length - 1];
      if (last) this.#lastFlushedSeq = last.seq;
      return pending.length;
    } finally {
      this.#flushing = false;
    }
  }

  /** 只合并传入字段，不会重置未提及的配置。 */
  config(patch: ConfigPatch): ConsolePlusConfig {
    if (patch.productName !== undefined) {
      if (typeof patch.productName !== "string" || !patch.productName.trim()) {
        throw new TypeError("[console-plus] productName must be a non-empty string.");
      }
      this.#config = { ...this.#config, productName: patch.productName };
    }
    if (patch.maxEntries !== undefined) {
      assertCapacity(patch.maxEntries);
      this.#config = { ...this.#config, maxEntries: patch.maxEntries };
      const kept = this.#buffer.toArray().slice(-patch.maxEntries);
      this.#buffer = new RingBuffer<LogRecord>(patch.maxEntries);
      for (const record of kept) this.#buffer.push(record);
    }
    if (patch.silentMode !== undefined) {
      this.#config = { ...this.#config, silentMode: Boolean(patch.silentMode) };
    }
    if (patch.reportUrl !== undefined) {
      this.#config = { ...this.#config, reportUrl: patch.reportUrl };
      if (this.#reporterIsDefault) {
        this.#reporter = patch.reportUrl ? createHttpReporter({ url: patch.reportUrl }) : null;
      }
    }
    return this.settings;
  }

  records(options?: ReadOptions | LogLevel): readonly LogRecord[] {
    return this.#select(options);
  }

  get(options?: ReadOptions | LogLevel): string {
    return renderRecords(this.#select(options));
  }

  clear(options?: ClearOptions | boolean): void {
    this.#buffer.clear();
    this.#persistence?.store.clear();
    const clearConsole = typeof options === "boolean" ? options : (options?.console ?? false);
    if (clearConsole && !this.#config.silentMode) {
      try {
        console.clear();
      } catch {
        // 宿主不支持 clear 时忽略
      }
    }
  }

  inject(): boolean {
    return this.#disposed ? false : this.#interceptor.inject();
  }

  restore(): boolean {
    return this.#interceptor.restore();
  }

  setReporter(reporter: Reporter | null): void {
    this.#reporter = reporter;
    this.#reporterIsDefault = false;
  }

  /** 先 flush 再回传：本地遗留批次优先，成功后按 seq 精确删除。 */
  async report(options: ReportOptions = {}): Promise<ReportResult> {
    if (this.#disposed) {
      return { ok: false, sent: 0, attempts: 0, error: "[console-plus] Instance disposed." };
    }
    const level = options.level ?? options.filter;
    if (level !== undefined) assertLogLevel(level, "level");

    const reporter = options.reportUrl
      ? createHttpReporter({ url: options.reportUrl })
      : (options.reporter ?? this.#reporter);
    if (!reporter) {
      throw new Error(
        "[console-plus] No reporter configured. Use setReporter(), pass { reporter }, or set reportUrl.",
      );
    }

    this.flush();
    const store = this.#persistence?.store;
    if (store && store.read().length > 0) {
      return this.#reportStored(store, reporter, options, level);
    }
    return this.#reportMemory(reporter, options, level);
  }

  dispose(): void {
    if (this.#disposed) return;
    this.flush();
    this.#detachPersistence();
    this.#interceptor.restore();
    this.#buffer.clear();
    this.#reporter = null;
    this.#disposed = true;
  }

  #setupPersistence(settings: PersistenceSettings): void {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    const store = new LocalLogStore(settings);
    if (!store.available) return;
    const flushThreshold = Math.max(1, settings.flushThreshold ?? DEFAULT_FLUSH_THRESHOLD);
    const flushIntervalMs = Math.max(100, settings.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS);
    this.#persistence = { store, flushThreshold };

    this.#flushTimer = setInterval(() => this.flush(), flushIntervalMs);

    if (settings.watchPageHide ?? true) {
      this.#onPageHide = () => this.flush();
      this.#onVisibility = () => {
        if (document.visibilityState === "hidden") this.flush();
      };
      window.addEventListener("pagehide", this.#onPageHide);
      document.addEventListener("visibilitychange", this.#onVisibility);
    }
  }

  #detachPersistence(): void {
    if (this.#flushTimer !== undefined) {
      clearInterval(this.#flushTimer);
      this.#flushTimer = undefined;
    }
    if (this.#onPageHide) {
      window.removeEventListener("pagehide", this.#onPageHide);
      this.#onPageHide = undefined;
    }
    if (this.#onVisibility) {
      document.removeEventListener("visibilitychange", this.#onVisibility);
      this.#onVisibility = undefined;
    }
    this.#persistence = null;
  }

  #reportMemory(
    reporter: Reporter,
    options: ReportOptions,
    level: LogLevel | undefined,
  ): Promise<ReportResult> {
    const selected = this.#select(level);
    if (selected.length === 0) return Promise.resolve({ ok: true, sent: 0, attempts: 0 });
    const batch = this.#buildBatch(selected, options, level);
    if (!batch) return Promise.resolve(this.#redactionFailure());
    return this.#send(reporter, batch).then((result) => {
      if (result.ok && (options.clear ?? true)) {
        const sent = new Set(selected.map((record) => record.seq));
        this.#buffer.pruneWhere((record) => sent.has(record.seq));
      }
      return result;
    });
  }

  async #reportStored(
    store: LocalLogStore,
    reporter: Reporter,
    options: ReportOptions,
    level: LogLevel | undefined,
  ): Promise<ReportResult> {
    let sentTotal = 0;
    let attempts = 0;
    let failed = 0;
    let processed = 0;
    let firstError: string | undefined;
    const sentSeqs = new Set<number>();

    for (const stored of store.read()) {
      const all = stored.records.map(fromStoredRecord);
      const selected = level ? all.filter((record) => record.level === level) : all;
      if (selected.length === 0) continue;
      processed += 1;

      const batch = this.#buildBatch(selected, options, level);
      if (!batch) {
        failed += 1;
        firstError ??= "[console-plus] Redaction failed, report aborted.";
        continue;
      }
      const result = await this.#send(reporter, batch);
      attempts += result.attempts;
      if (result.ok) {
        const seqs = new Set(selected.map((record) => record.seq));
        for (const seq of seqs) sentSeqs.add(seq);
        sentTotal += selected.length;
        store.removeSent(stored.id, seqs);
      } else {
        failed += 1;
        firstError ??= result.error ?? "Report failed.";
      }
    }

    if (sentSeqs.size > 0 && (options.clear ?? true)) {
      this.#buffer.pruneWhere((record) => sentSeqs.has(record.seq));
    }
    return {
      ok: failed === 0,
      sent: sentTotal,
      attempts,
      ...(firstError ? { error: firstError } : {}),
      failed,
      batches: processed,
    };
  }

  #buildBatch(
    records: readonly LogRecord[],
    options: ReportOptions,
    level: LogLevel | undefined,
  ): ReportBatch | null {
    let batch: ReportBatch = {
      product: this.#config.productName,
      ...(level ? { level } : {}),
      count: records.length,
      text: renderRecords(records),
      records,
      params: normalizeParams(options.params),
      createdAt: this.#clock.wallTime(),
    };
    if (this.#redact) {
      try {
        batch = this.#redact(batch);
      } catch {
        return null;
      }
    }
    return batch;
  }

  #redactionFailure(): ReportResult {
    return {
      ok: false,
      sent: 0,
      attempts: 0,
      error: "[console-plus] Redaction failed, report aborted.",
    };
  }

  async #send(reporter: Reporter, batch: ReportBatch): Promise<ReportResult> {
    try {
      return await reporter.send(batch);
    } catch (error) {
      return {
        ok: false,
        sent: 0,
        attempts: 1,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  #select(options?: ReadOptions | LogLevel): LogRecord[] {
    const level = typeof options === "string" ? options : options?.level;
    if (level !== undefined) assertLogLevel(level, "level");
    const all = this.#buffer.toArray();
    return level ? all.filter((record) => record.level === level) : all;
  }

  #emit(level: LogLevel, args: unknown[]): void {
    if (this.#disposed) return;
    this.#interceptor.callNative(level, args);
    this.#capture(level, args);
  }

  #capture(level: LogLevel, args: unknown[]): void {
    if (this.#disposed) return;
    try {
      const serialized = formatArgs(args);
      const record: LogRecord = {
        seq: ++this.#seq,
        level,
        product: this.#config.productName,
        elapsedMs: this.#clock.now(),
        wallTime: this.#clock.wallTime(),
        args: serialized,
        message: serialized.join(" "),
      };
      this.#buffer.push(record);
      const persistence = this.#persistence;
      if (persistence && this.#seq - this.#lastFlushedSeq >= persistence.flushThreshold) {
        this.flush();
      }
    } catch {
      // 收集永不打断业务
    }
  }
}

export function createConsolePlus(options?: ConsolePlusFactoryOptions): ConsolePlus {
  return new ConsolePlus(options);
}

/** Web / WebView 推荐入口：默认开启本地持久化与页面生命周期 flush。 */
export function createWebConsolePlus(options: ConsolePlusFactoryOptions = {}): ConsolePlus {
  return createConsolePlus({ ...options, persistence: options.persistence ?? true });
}
