/** Format a millisecond duration as "1:23.4" or "23.4s". */
export function formatDuration(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return '—';
  const total = Math.max(0, ms);
  const minutes = Math.floor(total / 60_000);
  const seconds = (total % 60_000) / 1000;
  if (minutes > 0) {
    return `${minutes}:${seconds.toFixed(1).padStart(4, '0')}`;
  }
  return `${seconds.toFixed(1)}s`;
}

/** Format placement as 1st / 2nd / 3rd / 4th… */
export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}
