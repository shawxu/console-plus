import type { LogLevel } from "./levels";

/** 内存中保存的结构化记录。 */
export interface LogRecord {
  readonly seq: number;
  readonly level: LogLevel;
  readonly product: string;
  /** performance.now()，相对页面起点的毫秒数 */
  readonly elapsedMs: number;
  /** ISO 8601 绝对时间 */
  readonly wallTime: string;
  readonly args: readonly string[];
  readonly message: string;
}

export interface Clock {
  now(): number;
  wallTime(): string;
}

export interface ReportBatch {
  readonly product: string;
  readonly level?: LogLevel;
  readonly count: number;
  readonly text: string;
  readonly records: readonly LogRecord[];
  readonly params: Readonly<Record<string, string>>;
  readonly timing?: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
}

export interface ReportResult {
  readonly ok: boolean;
  readonly sent: number;
  readonly attempts: number;
  readonly status?: number;
  readonly error?: string;
  /** 回传历史批次时失败的数量 */
  readonly failed?: number;
  /** 本次处理的批次数 */
  readonly batches?: number;
}

export interface Reporter {
  send(batch: ReportBatch): Promise<ReportResult>;
}

/** 仅作用于上报数据，不改动内存中的日志与控制台输出。 */
export type Redactor = (batch: ReportBatch) => ReportBatch;

/** localStorage 中的紧凑记录：省略 args，message 已含完整内容。 */
export interface StoredRecord {
  readonly s: number;
  readonly l: LogLevel;
  readonly p: string;
  readonly t: number;
  readonly w: string;
  readonly m: string;
}

export interface StoredBatch {
  readonly id: string;
  readonly createdAt: string;
  readonly records: readonly StoredRecord[];
}

export interface LocalLogStoreOptions {
  /** 默认 window.localStorage */
  storage?: Storage;
  key?: string;
  /** 默认 512KB */
  maxBytes?: number;
}

export interface PersistenceSettings extends LocalLogStoreOptions {
  /** 内存中未持久化日志达到该条数即 flush，默认 200 */
  flushThreshold?: number;
  /** 定时 flush 间隔，默认 10000ms */
  flushIntervalMs?: number;
  /** 监听 pagehide / visibilitychange(hidden)，默认 true */
  watchPageHide?: boolean;
}

export interface ConsolePlusOptions {
  productName?: string;
  maxEntries?: number;
  /** 收集但不再输出到原生 console */
  silentMode?: boolean;
  reportUrl?: string;
  reporter?: Reporter;
  /** 默认开启内置脱敏；false 关闭，或传入自定义 Redactor */
  redact?: boolean | Redactor;
  clock?: Clock;
  autoInject?: boolean;
  /** 默认关闭：写用户本地存储需要显式开启；true 用默认配置，或传入自定义配置 */
  persistence?: boolean | PersistenceSettings;
}

export interface ConsolePlusConfig {
  readonly productName: string;
  readonly maxEntries: number;
  readonly silentMode: boolean;
  readonly reportUrl: string;
}

/** config() 只合并传入的字段，不会重置未提及的配置。 */
export type ConfigPatch = Partial<
  Pick<ConsolePlusConfig, "productName" | "maxEntries" | "silentMode" | "reportUrl">
>;

export interface ReadOptions {
  level?: LogLevel;
}

export interface ReportOptions {
  level?: LogLevel;
  /** @deprecated 请用 level */
  filter?: LogLevel;
  params?: Readonly<Record<string, unknown>>;
  /** 仅在上报成功后清理已发送的那一批，默认 true */
  clear?: boolean;
  reporter?: Reporter;
  reportUrl?: string;
}

export interface ClearOptions {
  /** 是否同时清空原生控制台，默认 false */
  console?: boolean;
}
