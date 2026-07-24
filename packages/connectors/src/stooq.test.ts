import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchStooqCsv, STOOQ_CSV_REQUEST_INIT, stooqCsvUrl } from './stooq';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchStooqCsv', () => {
  it('uses stooq.com first with CSV request headers', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        'Symbol,Date,Time,Open,High,Low,Close,Volume\nVTI.US,N/D,N/D,N/D,N/D,N/D,N/D,N/D',
        {
          status: 200,
        },
      ),
    );
    vi.stubGlobal('fetch', fetchSpy);

    const result = await fetchStooqCsv('VTI.US');

    expect(result).toEqual({
      ok: true,
      body: 'Symbol,Date,Time,Open,High,Low,Close,Volume\nVTI.US,N/D,N/D,N/D,N/D,N/D,N/D,N/D',
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      stooqCsvUrl('stooq.com', 'VTI.US'),
      STOOQ_CSV_REQUEST_INIT,
    );
  });

  it('falls back to stooq.pl when stooq.com fails', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(new Response('bad gateway', { status: 522 }))
      .mockResolvedValueOnce(
        new Response(
          'Symbol,Date,Time,Open,High,Low,Close,Volume\nVTI.US,N/D,N/D,N/D,N/D,N/D,N/D,N/D',
          {
            status: 200,
          },
        ),
      );
    vi.stubGlobal('fetch', fetchSpy);

    const result = await fetchStooqCsv('VTI.US');

    expect(result).toEqual({
      ok: true,
      body: 'Symbol,Date,Time,Open,High,Low,Close,Volume\nVTI.US,N/D,N/D,N/D,N/D,N/D,N/D,N/D',
    });
    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      stooqCsvUrl('stooq.com', 'VTI.US'),
      STOOQ_CSV_REQUEST_INIT,
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      stooqCsvUrl('stooq.pl', 'VTI.US'),
      STOOQ_CSV_REQUEST_INIT,
    );
  });

  it('falls back to stooq.pl when stooq.com returns non-CSV content with HTTP 200', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(new Response('<html>blocked</html>', { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          'Symbol,Date,Time,Open,High,Low,Close,Volume\nVTI.US,N/D,N/D,N/D,N/D,N/D,N/D,N/D',
          {
            status: 200,
          },
        ),
      );
    vi.stubGlobal('fetch', fetchSpy);

    const result = await fetchStooqCsv('VTI.US');

    expect(result.ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('returns both host failures when neither Stooq host responds', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('bad gateway', { status: 522 })));

    const result = await fetchStooqCsv('VTI.US');

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'fetch_failed',
        message: 'stooq.com: HTTP 522; stooq.pl: HTTP 522',
      },
    });
  });
});
