/**
 * Debounce utility for batching rapid function calls
 * Default delay: 400ms (configurable)
 */

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number = 400
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function debounced(...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      func(...args);
      timeoutId = null;
    }, delay);
  };
}

/**
 * Throttle utility for rate-limiting function calls
 * Ensures function executes at most once per interval
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  interval: number = 300
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function throttled(...args: Parameters<T>) {
    const now = Date.now();
    const timeSinceLastCall = now - lastCall;

    if (timeSinceLastCall >= interval) {
      lastCall = now;
      func(...args);
    } else {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        func(...args);
        timeoutId = null;
      }, interval - timeSinceLastCall);
    }
  };
}
