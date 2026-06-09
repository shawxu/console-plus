declare module "console-plus" {
  interface CPConfig {
    /** 产品名称，默认 'console-plus' */
    productName?: string;
    /** 上报接口地址 */
    reportUrl?: string;
    /** 静默模式，不输出到原生 console */
    silentMode?: boolean;
  }

  interface CPReportOptions {
    /** 上报组件路径 */
    componentUrl?: string;
    /** 上报地址 */
    reportUrl?: string;
    /** 只上报指定级别的日志 */
    filter?: "debug" | "error" | "info" | "log" | "warn";
    /** 附加参数 */
    params?: Record<string, string>;
    /** 上报后是否清空队列，默认 true */
    clear?: boolean;
  }

  interface ConsolePlus {
    /** 记录 debug 日志 */
    debug(...args: unknown[]): void;
    /** 记录 error 日志 */
    error(...args: unknown[]): void;
    /** 记录 info 日志 */
    info(...args: unknown[]): void;
    /** 记录 log 日志 */
    log(...args: unknown[]): void;
    /** 记录 warn 日志 */
    warn(...args: unknown[]): void;

    /** 全局配置 */
    config(opts?: CPConfig): void;

    /** 获取收集的日志，可选按级别过滤 */
    get(filter?: "debug" | "error" | "info" | "log" | "warn"): string;

    /** 清空日志队列，可选同时清空浏览器 console 面板 */
    clear(clearConsole?: boolean): void;

    /** 上报日志到服务端 */
    report(opts?: CPReportOptions): Promise<void>;

    /** 将 cp 方法注入回 window.console */
    inject(): void;
  }

  const cp: ConsolePlus;
  export default cp;
}
