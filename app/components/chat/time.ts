export const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export function dayLabel(iso: string): string {
  const d = new Date(iso);
  const diff = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return d.toLocaleDateString('en-NG', { weekday: 'long' });
  return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
}

/** Short stamp for inbox rows: time today, otherwise weekday or date. */
export function listStamp(iso: string): string {
  const d = new Date(iso);
  const diff = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86_400_000);
  if (diff === 0) return timeLabel(iso);
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return d.toLocaleDateString('en-NG', { weekday: 'short' });
  return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });
}

export const sameDay = (a: string, b: string) => startOfDay(new Date(a)) === startOfDay(new Date(b));
