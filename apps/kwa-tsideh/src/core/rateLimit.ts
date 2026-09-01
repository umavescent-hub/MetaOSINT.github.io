import type { SourceId } from './types';

/**
 * Per-source client-side floor between calls. Keeps us inside anonymous rate
 * limits without a backend, and keeps one chatty source from burning another's
 * budget.
 */
const lastCallAt = new Map<SourceId, number>();

export async function waitForSlot(id: SourceId, minIntervalMs: number, signal: AbortSignal): Promise<void> {
  const last = lastCallAt.get(id);
  const now = Date.now();
  if (last !== undefined) {
    const wait = minIntervalMs - (now - last);
    if (wait > 0) {
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(resolve, wait);
        signal.addEventListener(
          'abort',
          () => {
            clearTimeout(t);
            reject(new DOMException('Aborted', 'AbortError'));
          },
          { once: true },
        );
      });
    }
  }
  lastCallAt.set(id, Date.now());
}
