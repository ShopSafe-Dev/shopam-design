/** Same limits as the server (core/documents.py): PDF, PNG, JPG; 5 files; 10 MB each; 25 MB together. */
export const SUPPORT_TYPES = ['application/pdf', 'image/png', 'image/jpeg'];
export const SUPPORT_MAX_FILES = 5;
const MAX_FILE = 10 * 1024 * 1024;
const MAX_TOTAL = 25 * 1024 * 1024;

/** Returns an error text, or '' when the files are fine. */
export function checkSupportFiles(files: File[]): string {
  if (files.length > SUPPORT_MAX_FILES) return `Attach at most ${SUPPORT_MAX_FILES} files.`;
  if (files.some((f) => !SUPPORT_TYPES.includes(f.type))) return 'Files must be PDF, PNG or JPG.';
  if (files.some((f) => f.size > MAX_FILE)) return 'Each file must be 10 MB or smaller.';
  if (files.reduce((n, f) => n + f.size, 0) > MAX_TOTAL) return 'Files must be 25 MB or less in total.';
  return '';
}

export function apiErrorText(e: unknown, fallback: string): string {
  const data = (e as { response?: { data?: unknown } }).response?.data;
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>;
    if (typeof d.error === 'string') return d.error;
    const first = Object.values(d).flat()[0];
    if (typeof first === 'string') return first;
  }
  return fallback;
}
