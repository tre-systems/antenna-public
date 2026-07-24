import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import renderToString from 'preact-render-to-string';
import { OfflineBanner } from './OfflineBanner';
import { isOffline, lastFetchedAt } from '../signals/signals';

beforeEach(() => {
  isOffline.value = false;
  lastFetchedAt.value = null;
});

afterEach(() => {
  isOffline.value = false;
  lastFetchedAt.value = null;
});

describe('OfflineBanner', () => {
  it('renders nothing when not offline', () => {
    expect(renderToString(<OfflineBanner />)).toBe('');
  });

  it('renders the banner with a relative timestamp when last fetched is known', () => {
    isOffline.value = true;
    lastFetchedAt.value = Date.now() - 5 * 60 * 1000;
    const html = renderToString(<OfflineBanner />);
    expect(html).toContain('data-testid="offline-banner"');
    expect(html).toContain('Offline —');
    expect(html).toContain('cached data, last seen');
  });

  it('falls back to a generic message when last fetched is unknown', () => {
    isOffline.value = true;
    lastFetchedAt.value = null;
    const html = renderToString(<OfflineBanner />);
    expect(html).toContain('showing the last data we have');
  });
});
