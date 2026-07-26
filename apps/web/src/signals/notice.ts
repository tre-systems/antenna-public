import { signal } from '@preact/signals';

// Transient success/status message. It auto-dismisses; a lightweight cousin of the undo toast.
export const notice = signal<string | null>(null);

const NOTICE_WINDOW_MS = 5000;
let noticeTimeoutId: ReturnType<typeof setTimeout> | null = null;

export function showNotice(message: string): void {
  if (noticeTimeoutId) clearTimeout(noticeTimeoutId);
  notice.value = message;
  noticeTimeoutId = setTimeout(() => {
    notice.value = null;
    noticeTimeoutId = null;
  }, NOTICE_WINDOW_MS);
}

export function dismissNotice(): void {
  if (noticeTimeoutId) {
    clearTimeout(noticeTimeoutId);
    noticeTimeoutId = null;
  }
  notice.value = null;
}
