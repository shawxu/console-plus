import { LOG_LEVELS } from "./levels";
import type { LogLevel } from "./levels";

export type ConsoleTarget = Record<LogLevel, unknown>;

type NativeMethod = (...args: unknown[]) => void;

export interface InterceptorOptions {
  capture: (level: LogLevel, args: unknown[]) => void;
  isSilent: () => boolean;
  /** 可注入一个替代 console 的对象，便于测试与沙箱环境 */
  target?: ConsoleTarget;
}

/**
 * 零侵入拦截：原生输出永远先发生，且收集逻辑的任何异常都被吞掉。
 * WebView 里宿主 App 或其他 SDK 也可能包装 console，restore() 绝不覆盖别人的引用。
 */
export class ConsoleInterceptor {
  readonly #capture: InterceptorOptions["capture"];
  readonly #isSilent: InterceptorOptions["isSilent"];
  readonly #target: ConsoleTarget;
  readonly #originals = new Map<LogLevel, NativeMethod>();
  readonly #proxies = new Map<LogLevel, NativeMethod>();
  #injected = false;

  constructor(options: InterceptorOptions) {
    this.#capture = options.capture;
    this.#isSilent = options.isSilent;
    this.#target = options.target ?? (console as unknown as ConsoleTarget);
  }

  get injected(): boolean {
    return this.#injected;
  }

  /** cp.info() 等主动调用走这里：注入后使用保存的原始引用，不会递归。 */
  callNative(level: LogLevel, args: readonly unknown[]): void {
    const native = this.#originals.get(level) ?? this.#target[level];
    if (typeof native !== "function") return;
    this.#emitNative(args, native as NativeMethod, this.#target);
  }

  inject(): boolean {
    if (this.#injected) return false;

    const proxies = new Map<LogLevel, NativeMethod>();
    for (const level of LOG_LEVELS) {
      const original: unknown = this.#target[level];
      if (typeof original !== "function") continue;
      const native = original as NativeMethod;

      const proxy = new Proxy(native, {
        apply: (target, thisArg, args: unknown[]) => {
          this.#emitNative(args, target, thisArg);
          try {
            this.#capture(level, args);
          } catch {
            // 收集失败绝不影响业务
          }
          return undefined;
        },
      });
      proxies.set(level, proxy);
      this.#originals.set(level, native);
    }

    for (const [level, proxy] of proxies) this.#target[level] = proxy;
    this.#proxies.clear();
    for (const [level, proxy] of proxies) this.#proxies.set(level, proxy);
    this.#injected = proxies.size > 0;
    return this.#injected;
  }

  /**
   * 只还原仍由自己占据的位置。若宿主或其他 SDK 在我们之后又包装了 console，
   * 跳过该级别并保持 injected=true，可稍后重试；强行还原会破坏别人的 hook。
   */
  restore(): boolean {
    if (!this.#injected) return false;

    let detached = 0;
    let occupied = 0;
    for (const [level, native] of this.#originals) {
      const proxy = this.#proxies.get(level);
      if (proxy && this.#target[level] !== proxy) {
        occupied += 1;
        continue;
      }
      this.#target[level] = native;
      // 已还原的级别不再跟踪，避免重试时把 original 误判成「被外部占用」
      this.#originals.delete(level);
      this.#proxies.delete(level);
      detached += 1;
    }

    if (occupied > 0) return false;
    this.#originals.clear();
    this.#proxies.clear();
    this.#injected = false;
    return detached > 0;
  }

  #emitNative(args: readonly unknown[], native: NativeMethod, thisArg: unknown): void {
    if (this.#isSilent()) return;
    try {
      Reflect.apply(native, thisArg, args);
    } catch {
      // 宿主 console 自身抛错也不允许影响业务
    }
  }
}
