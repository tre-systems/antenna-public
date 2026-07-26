import { sourcePolicyForTemplate } from './source-policy';
import { safeExternalUrl } from './safe-url';
import { macroPreset, type MacroPreset } from './display-macro';
import {
  capitaliseFirst,
  splitList,
  stringValue,
  stripExchange,
  stripQuote,
} from './display-values';

export const displayTitle = (
  templateId: string,
  fallback: string,
  config: Readonly<Record<string, unknown>>,
): string => {
  if (templateId === 'fx-pair') {
    const pair = stringValue(config.pair);
    if (pair) return pair;
    const base = stringValue(config.base);
    const quote = stringValue(config.quote);
    if (base && quote) return `${base}/${quote}`;
  }
  if (templateId === 'crypto-watchlist') {
    const pairs = splitList(config.pairs).map(stripQuote);
    if (pairs.length) return formatListTitle('Crypto', pairs);
  }
  if (templateId === 'crypto-history') {
    const pairs = splitList(config.pairs).map(stripQuote);
    if (pairs.length) return formatListTitle('Crypto history', pairs);
  }
  if (templateId === 'weather' || templateId === 'airquality') {
    const location = stringValue(config.location);
    if (location) return `${templateId === 'weather' ? 'Weather' : 'Air quality'} — ${location}`;
  }
  if (templateId === 'equity-watchlist') {
    const tickers = splitList(config.tickers).map(stripExchange);
    if (tickers.length) return formatListTitle('Stocks', tickers);
  }
  if (templateId === 'market-history') {
    const labelOverride = stringValue(config.label);
    if (labelOverride) return `${labelOverride} 1Y`;
    const symbol = stringValue(config.symbol);
    if (symbol) {
      const stripped = stripExchange(symbol);
      return `${FRIENDLY_FUND_NAMES[stripped] ?? stripped} 1Y`;
    }
  }
  if (templateId === 'market-overview') return 'Market overview';
  if (templateId === 'macro-market-history') {
    const preset = macroPreset(templateId, config);
    if (preset) return `${preset.label} 1Y`;
  }
  if (templateId === 'trading-economics-market') {
    const label = stringValue(config.label);
    if (label) return `${label} 1Y`;
    const symbol = stringValue(config.symbol);
    if (symbol) return `${symbol} 1Y`;
  }
  if (templateId === 'github-repo-activity') {
    const owner = stringValue(config.owner);
    const repo = stringValue(config.repo);
    if (owner && repo) return `${owner}/${repo}`;
  }
  if (templateId === 'github-trending') return 'GitHub Trending';
  if (templateId === 'karpathy-jobs-snapshot') return 'AI jobs exposure';
  if (templateId === 'sector-movers') return 'US sector movers';
  if (templateId === 'tbench-leaderboard') return 'Terminal Bench leaderboard';
  if (templateId === 'aa-highlights') {
    const category = stringValue(config.category);
    if (category === 'speed') return 'AA Speed';
    if (category === 'price') return 'AA Price';
    return 'AA Intelligence';
  }
  if (templateId === 'aa-frontier') return 'Frontier model comparison';
  if (templateId === 'app-usage') {
    const project = stringValue(config.project);
    if (project === 'rgou') return 'Royal Game of Ur usage';
    if (project) return `${capitaliseFirst(project)} usage`;
  }
  if (templateId === 'cloudflare-analytics') return 'Cloudflare traffic';
  if (templateId === 'project-portfolio') return 'TRE project portfolio';
  if (templateId === 'manual-cost') {
    const provider = stringValue(config.provider);
    const project = stringValue(config.project);
    if (provider && project) return `${provider} · ${project} costs`;
    if (provider) return `${provider} costs`;
  }
  if (templateId === 'manual-metric') return stringValue(config.label) ?? fallback;
  return fallback || templateId;
};

export const templateSourceUrl = (
  templateId: string,
  config: Readonly<Record<string, unknown>>,
  pointSourceUrls: ReadonlyArray<string | null | undefined>,
  preset: MacroPreset | null,
): string | null => {
  const pointUrl = pointSourceUrls.map(safeExternalUrl).find((url) => url !== null);
  if (pointUrl) return pointUrl;

  const configured = safeExternalUrl(config.sourceUrl);
  if (configured) return configured;
  if (preset) return preset.sourceUrl;

  if (templateId === 'fx-pair') {
    const base = stringValue(config.base)?.toUpperCase();
    const quote = stringValue(config.quote)?.toUpperCase();
    if (base && quote) {
      return `https://www.frankfurter.app/?from=${encodeURIComponent(base)}&to=${encodeURIComponent(quote)}`;
    }
    return 'https://www.frankfurter.app/';
  }
  if (templateId === 'crypto-watchlist' || templateId === 'crypto-history') {
    const pair = splitList(config.pairs)[0];
    const base = pair?.split('-')[0]?.toLowerCase();
    return base ? `https://www.coinbase.com/price/${encodeURIComponent(base)}` : null;
  }
  if (templateId === 'equity-watchlist') {
    const tickers = splitList(config.tickers);
    if (tickers.length === 1 && tickers[0]) {
      return `https://stooq.com/q/?s=${encodeURIComponent(tickers[0].toLowerCase())}`;
    }
    return 'https://stooq.com/';
  }
  if (templateId === 'market-history') {
    const symbol = stringValue(config.symbol);
    return symbol ? `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}/` : null;
  }
  if (templateId === 'weather' || templateId === 'airquality') {
    return typeof config.lat === 'number' && typeof config.lon === 'number'
      ? `https://open-meteo.com/en/forecast?latitude=${String(config.lat)}&longitude=${String(config.lon)}`
      : 'https://open-meteo.com/';
  }
  if (templateId === 'github-repo-activity') {
    const owner = stringValue(config.owner);
    const repo = stringValue(config.repo);
    if (owner && repo) {
      return `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
    }
    return 'https://github.com/';
  }
  if (templateId === 'github-trending') return 'https://github.com/trending';
  if (templateId === 'karpathy-jobs-snapshot') return 'https://karpathy.ai/jobs/';
  if (templateId === 'rest-metric') return safeExternalUrl(config.url);
  return safeExternalUrl(sourcePolicyForTemplate(templateId)?.sourceUrl);
};

const LIST_TITLE_MAX = 3;

const formatListTitle = (prefix: string, items: readonly string[]): string => {
  if (items.length === 0) return prefix;
  if (items.length <= LIST_TITLE_MAX) return `${prefix}: ${items.join(', ')}`;
  const shown = items.slice(0, LIST_TITLE_MAX).join(', ');
  return `${prefix}: ${shown} +${String(items.length - LIST_TITLE_MAX)} more`;
};

const FRIENDLY_FUND_NAMES: Readonly<Record<string, string>> = {
  '0P000125KV': 'Fidelity Index World P',
};
