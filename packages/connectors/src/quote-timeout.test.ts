import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchStooqCsv } from './stooq';
import { fetchYahooLatestQuote } from './yahoo-quote';
import { marketOverviewStooq } from './market-overview-stooq';

const timeout = vi.fn<(ms: number) => AbortSignal>();

beforeEach(() => {
  vi.useFakeTimers();
  timeout.mockReset().mockImplementation((ms) => {
    const controller = new AbortController();
    setTimeout(() => {
      controller.abort(new DOMException('Quote request timed out', 'TimeoutError'));
    }, ms);
    return controller.signal;
  });
  vi.spyOn(AbortSignal, 'timeout').mockImplementation(timeout);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const stalledFetch = (_url: unknown, init: RequestInit): Promise<Response> =>
  new Promise((_resolve, reject) => {
    init.signal?.addEventListener(
      'abort',
      () => {
        reject(new DOMException('Quote request timed out', 'TimeoutError'));
      },
      { once: true },
    );
  });

const stalledBody = (_url: unknown, init: RequestInit): Promise<Response> =>
  Promise.resolve(
    new Response(
      new ReadableStream({
        start(controller) {
          init.signal?.addEventListener(
            'abort',
            () => {
              controller.error(new DOMException('Quote request timed out', 'TimeoutError'));
            },
            { once: true },
          );
        },
      }),
    ),
  );

describe('quote request deadlines', () => {
  it('falls back to the second Stooq host after a stalled primary request', async () => {
    const fetchSpy = vi
      .fn()
      .mockImplementationOnce(stalledFetch)
      .mockResolvedValueOnce(new Response('Symbol,Date,Time,Open,High,Low,Close,Volume\n'));
    vi.stubGlobal('fetch', fetchSpy);

    const result = fetchStooqCsv('VTI.US');
    await vi.advanceTimersByTimeAsync(8_000);

    await expect(result).resolves.toMatchObject({ ok: true });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(timeout).toHaveBeenNthCalledWith(1, 8_000);
    expect(timeout).toHaveBeenNthCalledWith(2, 8_000);
  });

  it('finishes with a recoverable error when both Stooq response bodies stall', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(stalledBody));

    const result = fetchStooqCsv('VTI.US');
    await vi.advanceTimersByTimeAsync(16_000);

    await expect(result).resolves.toMatchObject({ ok: false, error: { code: 'fetch_failed' } });
  });

  it.each([stalledFetch, stalledBody])('bounds Yahoo headers and body reads', async (fetch) => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(fetch));

    const result = fetchYahooLatestQuote('VTI');
    await vi.advanceTimersByTimeAsync(8_000);

    await expect(result).resolves.toMatchObject({ ok: false, error: { code: 'fetch_failed' } });
    expect(timeout).toHaveBeenCalledWith(8_000);
  });

  it('completes all seven market proxies within 168 seconds when every upstream stalls', async () => {
    const fetchSpy = vi.fn().mockImplementation(stalledFetch);
    vi.stubGlobal('fetch', fetchSpy);

    const result = marketOverviewStooq({});
    await vi.advanceTimersByTimeAsync(168_000);

    await expect(result).resolves.toMatchObject({ ok: false, error: { code: 'fetch_failed' } });
    expect(fetchSpy).toHaveBeenCalledTimes(21);
  });

  it('does not classify invalid Yahoo JSON as a timeout', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('invalid JSON')));

    await expect(fetchYahooLatestQuote('VTI')).resolves.toMatchObject({
      ok: false,
      error: { code: 'parse_failed' },
    });
  });
});
