import { afterEach, describe, expect, it } from 'vitest';
import renderToString from 'preact-render-to-string';
import { NoticeToast } from './NoticeToast';
import { dismissNotice, notice } from '../signals/signals';

afterEach(() => {
  dismissNotice();
});

describe('NoticeToast', () => {
  it('renders nothing when there is no notice', () => {
    notice.value = null;
    expect(renderToString(<NoticeToast />)).toBe('');
  });

  it('renders the message and a dismiss control when a notice is set', () => {
    notice.value = 'Your first signal is live — fetching data now.';
    const html = renderToString(<NoticeToast />);
    expect(html).toContain('data-testid="notice-toast"');
    expect(html).toContain('role="status"');
    expect(html).toContain('Your first signal is live');
    expect(html).toContain('data-testid="notice-toast-dismiss"');
  });
});
