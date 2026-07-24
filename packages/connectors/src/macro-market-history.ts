import { yahooMarketHistory } from './market-yahoo';
import {
  dateRange,
  boeDateParam,
  fetchJson,
  fetchText,
  isoDateRange,
  parseBoeCsv,
  parseEiaPetroleumDailyHtml,
  parseFailed,
  parseFrankfurter,
  parseFredCsv,
  pointsResult,
} from './macro-market-history-utils';
import type { Adapter, AdapterResult } from './types';

export type MacroMarketHistoryConfig =
  | {
      readonly kind: 'boe-series';
      readonly series: string;
      readonly label: string;
      readonly unit?: string;
      readonly sourceUrl?: string;
      readonly days?: number;
    }
  | {
      readonly kind: 'frankfurter-pair';
      readonly base: string;
      readonly quote: string;
      readonly label: string;
      readonly unit?: string;
      readonly sourceUrl?: string;
      readonly days?: number;
    }
  | {
      readonly kind: 'fred-csv';
      readonly seriesId: string;
      readonly label: string;
      readonly unit?: string;
      readonly sourceUrl?: string;
      readonly days?: number;
    }
  | {
      readonly kind: 'eia-petroleum-html';
      readonly symbol: string;
      readonly label: string;
      readonly unit?: string;
      readonly sourceUrl?: string;
      readonly days?: number;
    }
  | {
      readonly kind: 'yahoo-symbol';
      readonly symbol: string;
      readonly label: string;
      readonly unit?: string;
      readonly sourceUrl?: string;
      readonly days?: number;
    };

export const macroMarketHistory: Adapter<MacroMarketHistoryConfig> = async (
  config,
): Promise<AdapterResult> => {
  switch (config.kind) {
    case 'boe-series':
      return fetchBoeSeries(config);
    case 'frankfurter-pair':
      return fetchFrankfurterPair(config);
    case 'fred-csv':
      return fetchFredCsv(config);
    case 'eia-petroleum-html':
      return fetchEiaPetroleumHtml(config);
    case 'yahoo-symbol':
      return fetchYahooSymbol(config);
  }
};

const fetchBoeSeries = async (
  config: Extract<MacroMarketHistoryConfig, { kind: 'boe-series' }>,
): Promise<AdapterResult> => {
  const series = config.series.trim().toUpperCase();
  if (!series) return parseFailed('series is required');

  const { start, end } = dateRange(config.days);
  const params = new URLSearchParams({
    'csv.x': 'yes',
    Datefrom: boeDateParam(start),
    Dateto: boeDateParam(end),
    SeriesCodes: series,
    UsingCodes: 'Y',
    VPD: 'Y',
    VFD: 'N',
  });
  const url = `https://www.bankofengland.co.uk/boeapps/database/_iadb-fromshowcolumns.asp?${params.toString()}`;
  const fetched = await fetchText(url, { accept: 'text/csv' });
  if (!fetched.ok) return fetched;

  const points = parseBoeCsv(fetched.body, {
    symbol: series,
    label: config.label,
    unit: config.unit,
    sourceUrl: config.sourceUrl,
  });
  return pointsResult(points, fetched.body);
};

const fetchFrankfurterPair = async (
  config: Extract<MacroMarketHistoryConfig, { kind: 'frankfurter-pair' }>,
): Promise<AdapterResult> => {
  const base = config.base.trim().toUpperCase();
  const quote = config.quote.trim().toUpperCase();
  if (!base || !quote) return parseFailed('base and quote are required');

  const { startIso, endIso } = isoDateRange(config.days);
  const params = new URLSearchParams({ base, symbols: quote });
  const url = `https://api.frankfurter.dev/v1/${startIso}..${endIso}?${params.toString()}`;
  const fetched = await fetchJson(url);
  if (!fetched.ok) return fetched;

  const points = parseFrankfurter(fetched.body, quote, {
    symbol: `${base}/${quote}`,
    label: config.label,
    unit: config.unit ?? quote,
    sourceUrl: config.sourceUrl,
  });
  return pointsResult(points, fetched.body);
};

const fetchFredCsv = async (
  config: Extract<MacroMarketHistoryConfig, { kind: 'fred-csv' }>,
): Promise<AdapterResult> => {
  const seriesId = config.seriesId.trim().toUpperCase();
  if (!seriesId) return parseFailed('seriesId is required');

  const { startIso, endIso } = isoDateRange(config.days);
  const params = new URLSearchParams({ id: seriesId, cosd: startIso, coed: endIso });
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?${params.toString()}`;
  const fetched = await fetchText(url, { accept: 'text/csv' });
  if (!fetched.ok) return fetched;

  const points = parseFredCsv(fetched.body, {
    symbol: seriesId,
    label: config.label,
    unit: config.unit,
    sourceUrl: config.sourceUrl,
  });
  return pointsResult(points, fetched.body);
};

const fetchEiaPetroleumHtml = async (
  config: Extract<MacroMarketHistoryConfig, { kind: 'eia-petroleum-html' }>,
): Promise<AdapterResult> => {
  const symbol = config.symbol.trim().toUpperCase();
  if (!symbol) return parseFailed('symbol is required');

  const url = config.sourceUrl ?? 'https://www.eia.gov/dnav/pet/hist/RWTCd.htm';
  const fetched = await fetchText(url, { accept: 'text/html' });
  if (!fetched.ok) return fetched;

  const cutoff = Date.now() - (config.days ?? 365) * 86_400_000;
  const points = parseEiaPetroleumDailyHtml(fetched.body, {
    symbol,
    label: config.label,
    unit: config.unit,
    sourceUrl: url,
  }).filter((point) => point.ts >= cutoff);
  return pointsResult(points, fetched.body);
};

const fetchYahooSymbol = async (
  config: Extract<MacroMarketHistoryConfig, { kind: 'yahoo-symbol' }>,
): Promise<AdapterResult> => {
  const result = await yahooMarketHistory({ symbol: config.symbol, range: '1y' });
  if (!result.ok) return result;
  return {
    ok: true,
    rawPayload: result.rawPayload,
    points: result.points.map((point) => ({
      ...point,
      dimensions: { symbol: config.symbol.toUpperCase(), label: config.label },
      unit: config.unit ?? point.unit,
      sourceUrl: config.sourceUrl ?? point.sourceUrl,
    })),
  };
};
