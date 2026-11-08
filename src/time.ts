import type { Clock } from "./types";

/** Web 专属：performance.now() 提供单调时序，Date 提供绝对时间。 */
export function createClock(): Clock {
  return {
    now: () => performance.now(),
    wallTime: () => new Date().toISOString(),
  };
}
