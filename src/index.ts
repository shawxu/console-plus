import { createConsolePlus } from "./logger";

export { ConsolePlus, createConsolePlus, createWebConsolePlus } from "./logger";
export type { ConsolePlusFactoryOptions } from "./logger";
export { fromStoredRecord, LocalLogStore, toStoredRecord } from "./persistence";
export { LOG_LEVELS, isLogLevel, assertLogLevel } from "./levels";
export type { LogLevel } from "./levels";
export { formatArgs, renderRecord, renderRecords, serializeArg } from "./serialize";
export { RingBuffer } from "./ring-buffer";
export { createClock } from "./time";
export { redactText, resolveRedactor } from "./redact";
export { createHttpReporter, normalizeParams, validateReportUrl } from "./reporters/http";
export type { HttpReporterOptions } from "./reporters/http";
export type {
  ClearOptions,
  Clock,
  ConfigPatch,
  ConsolePlusConfig,
  ConsolePlusOptions,
  LocalLogStoreOptions,
  LogRecord,
  PersistenceSettings,
  ReadOptions,
  Redactor,
  ReportBatch,
  ReportOptions,
  ReportResult,
  Reporter,
  StoredBatch,
  StoredRecord,
} from "./types";

/** 默认实例；构造函数不触碰宿主 console，也不写 localStorage，导入本身无副作用。 */
export const cp = createConsolePlus();
