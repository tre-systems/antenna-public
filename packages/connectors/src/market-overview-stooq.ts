import type { Adapter, AdapterResult, DataPoint } from './types';
import {
  assessMarket,
  parseProxyCsv,
  PROXIES,
  proxyChangePoint,
  type MarketProxy,
  type Quote,
} from './market-overview-model';
import { fetchStooqCsv } from './stooq';
import { fetchYahooLatestQuote, yahooSymbolForStooqTicker } from './yahoo-quote';

export const marketOverviewStooq: Adapter = async (): Promise<AdapterResult> => {
  const quotes: Quote[] = [];
  const raw: string[] = [];
  const failures: string[] = [];
  for (const proxy of PROXIES) {
    const csv = await fetchStooqCsv(proxy.ticker);
    if (!csv.ok) {
      const fallback = await yahooQuoteForProxy(proxy);
      if (fallback.ok) {
        raw.push(JSON.stringify(fallback.rawPayload));
        quotes.push(fallback.quote);
        failures.push(`${proxy.ticker}: stooq ${csv.error.code}: ${csv.error.message}; used yahoo`);
        continue;
      }
      failures.push(
        `${proxy.ticker}: ${csv.error.code}: ${csv.error.message}; yahoo ${fallback.error.code}: ${fallback.error.message}`,
      );
      continue;
    }
    const quote = parseProxyCsv(proxy, csv.body);
    if (!quote) {
      const fallback = await yahooQuoteForProxy(proxy);
      if (fallback.ok) {
        raw.push(csv.body, JSON.stringify(fallback.rawPayload));
        quotes.push(fallback.quote);
        failures.push(`${proxy.ticker}: stooq parse_failed: no quote; used yahoo`);
        continue;
      }
      failures.push(
        `${proxy.ticker}: parse_failed: no quote; yahoo ${fallback.error.code}: ${fallback.error.message}`,
      );
      continue;
    }
    raw.push(csv.body);
    quotes.push(quote);
  }
  if (quotes.length === 0) {
    const firstFailure = failures[0];
    if (firstFailure?.includes('fetch_failed')) {
      return { ok: false, error: { code: 'fetch_failed', message: failures.join('; ') } };
    }
    return {
      ok: false,
      error: { code: 'parse_failed', message: failures.join('; ') || 'no quotes parsed' },
    };
  }

  const assessment = assessMarket(quotes);
  const observedAt = Math.max(...quotes.map((q) => q.ts));
  const regimeSourceUrl = quotes.some((q) => urlHasHostname(q.sourceUrl, 'finance.yahoo.com'))
    ? 'https://finance.yahoo.com/'
    : 'https://stooq.com/';
  const points: DataPoint[] = [
    {
      dimensions: {
        metric: 'market_regime',
        risk_score: assessment.score,
        positive_count: assessment.positive,
        negative_count: assessment.negative,
      },
      value: assessment.regime,
      ts: observedAt,
      sourceUrl: regimeSourceUrl,
    },
    ...quotes.map(proxyChangePoint),
  ];
  return { ok: true, points, rawPayload: { assessment, csv: raw, failures } };
};

// Substring matching on a URL would also accept `finance.yahoo.com.evil.test`;
// the fallback quote page is always exactly this host.
const urlHasHostname = (value: string, hostname: string): boolean => {
  try {
    return new URL(value).hostname === hostname;
  } catch {
    return false;
  }
};

type YahooProxyQuoteResult =
  | { readonly ok: true; readonly quote: Quote; readonly rawPayload: unknown }
  | Extract<AdapterResult, { ok: false }>;

const yahooQuoteForProxy = async (proxy: MarketProxy): Promise<YahooProxyQuoteResult> => {
  const result = await fetchYahooLatestQuote(yahooSymbolForStooqTicker(proxy.ticker));
  if (!result.ok) return result;
  return {
    ok: true,
    quote: {
      ...proxy,
      open: result.quote.previousClose,
      close: result.quote.price,
      changePct: result.quote.changePct,
      ts: result.quote.ts,
      sourceUrl: result.quote.sourceUrl,
    },
    rawPayload: result.rawPayload,
  };
};
