/**
 * Shared promise timeout helper.
 *
 * Extracted from `lib/multi-scan/profile-analyzer.ts` in Phase 5 so the JEV
 * adapter and the Phase 4 analyzer use one implementation instead of two
 * subtly different copies.
 *
 * Rejects with an `Error` whose message is `what`, so callers can map a
 * timeout to a specific failure code.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  what: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(what)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}
