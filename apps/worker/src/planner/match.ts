import { sourceLabelForTemplate, templates } from '@antenna/registry';
import type { CollectionPlan, ProposedSignal, UnmatchedHint } from '@antenna/shared';
import { resolveDemoCity } from './geocode';
import { enrichConnectorRequest } from './setup-requests';
import { validateTemplateConfig } from '../registry/config';

type Template = (typeof templates)[number];

// Split prompt fragments on commas and common conjunctions.
const FRAGMENT_SPLIT_RX = /\s*(?:,|\band\b|\bplus\b|\bthen\b)\s*/i;

const fragmentsOf = (prompt: string): ReadonlyArray<string> =>
  prompt
    .split(FRAGMENT_SPLIT_RX)
    .map((f) => f.trim())
    .filter((f) => f.length > 0);

const MARKET_SYMBOL_FRAGMENT_RX = /^[A-Z0-9]{1,12}(?:\.[A-Z]{1,3})?$/;
const CRYPTO_SYMBOL_FRAGMENT_RX =
  /^(?:BTC|ETH|SOL|ADA|DOGE|bitcoin|ethereum|solana|cardano|dogecoin)$/i;
const HISTORY_INTENT_RX =
  /\b(?:chart|graph|history|historical|yearly|one[-\s]?year|1y|over\s+time|trend)\b/i;

const bestTemplate = (fragment: string): Template | undefined => {
  let best: Template | undefined;
  let bestScore = 0;
  for (const template of templates) {
    if (template.plannerEnabled === false) continue;
    let score = 0;
    for (const hint of template.matchHints) {
      if (hint.test(fragment)) score += 1;
    }
    // Strict `>` preserves registration order on ties (first wins).
    if (score > bestScore) {
      best = template;
      bestScore = score;
    }
  }
  return bestScore > 0 ? best : undefined;
};

const templateById = (id: string): Template | undefined => templates.find((t) => t.id === id);

const isStandaloneMarketSymbol = (fragment: string): boolean =>
  MARKET_SYMBOL_FRAGMENT_RX.test(fragment.trim());

const isStandaloneCryptoSymbol = (fragment: string): boolean =>
  CRYPTO_SYMBOL_FRAGMENT_RX.test(fragment.trim());

const unmatchedHint = (fragment: string, prompt: string): UnmatchedHint => {
  const enrichment = enrichConnectorRequest(fragment, prompt);
  return {
    fragment,
    ...(enrichment.blocker_reason === undefined
      ? {}
      : { blocker_reason: enrichment.blocker_reason }),
    ...(enrichment.acquisition_state === undefined
      ? {}
      : { acquisition_state: enrichment.acquisition_state }),
    ...(enrichment.acquisition_strategy === undefined
      ? {}
      : { acquisition_strategy: enrichment.acquisition_strategy }),
  };
};

const buildSignal = (template: Template, fragment: string): ProposedSignal => {
  const config: Record<string, unknown> = {};
  const missing: string[] = [];
  for (const key of template.paramKeys) {
    const extractor = template.paramExtractors[key];
    const value = extractor ? extractor(fragment) : undefined;
    if (value === undefined) {
      missing.push(key);
    } else {
      config[key] = value;
    }
  }
  if ((template.id === 'weather' || template.id === 'airquality') && config.location) {
    const coordinates = resolveDemoCity(config.location);
    if (coordinates) {
      config.location = coordinates.location;
      config.lat = coordinates.lat;
      config.lon = coordinates.lon;
      const unresolved = new Set(missing);
      unresolved.delete('lat');
      unresolved.delete('lon');
      missing.splice(0, missing.length, ...unresolved);
    }
  }

  const validatedConfig = missing.length === 0 ? validateTemplateConfig(template, config) : config;

  return {
    template_id: template.id,
    display_name: template.displayName,
    config: validatedConfig,
    missing,
    refresh_seconds: template.defaultRefreshSeconds,
    rights_status: template.rightsStatus,
    source_label: sourceLabelForTemplate(template.id, template.displayName),
  };
};

export const planTemplate = (templateId: string): CollectionPlan | undefined => {
  const template = templateById(templateId);
  if (!template || (template.plannerEnabled === false && template.directProposalEnabled !== true)) {
    return undefined;
  }
  const prompt = `Add ${template.displayName}`;
  return { prompt, signals: [buildSignal(template, '')], unmatched: [] };
};

export const matchPrompt = (prompt: string): CollectionPlan => {
  const signals: ProposedSignal[] = [];
  const unmatched: UnmatchedHint[] = [];
  let carryMarketHistoryContext = HISTORY_INTENT_RX.test(prompt);
  let carryCryptoHistoryContext = HISTORY_INTENT_RX.test(prompt);

  for (const fragment of fragmentsOf(prompt)) {
    if (carryCryptoHistoryContext && isStandaloneCryptoSymbol(fragment)) {
      const cryptoTemplate = templateById('crypto-history');
      if (cryptoTemplate) {
        signals.push(buildSignal(cryptoTemplate, `yearly chart ${fragment.trim().toUpperCase()}`));
      } else {
        unmatched.push(unmatchedHint(fragment, prompt));
        carryCryptoHistoryContext = false;
      }
    } else if (carryMarketHistoryContext && isStandaloneMarketSymbol(fragment)) {
      const marketTemplate = templateById('market-history');
      if (marketTemplate) {
        signals.push(buildSignal(marketTemplate, `yearly chart ${fragment.trim().toUpperCase()}`));
      } else {
        unmatched.push(unmatchedHint(fragment, prompt));
        carryMarketHistoryContext = false;
      }
    } else {
      const template = bestTemplate(fragment);
      if (template) {
        const signal = buildSignal(template, fragment);
        signals.push(signal);
        carryMarketHistoryContext = signal.template_id === 'market-history';
        carryCryptoHistoryContext = signal.template_id === 'crypto-history';
      } else {
        unmatched.push(unmatchedHint(fragment, prompt));
        carryMarketHistoryContext = false;
        carryCryptoHistoryContext = false;
      }
    }
  }

  return { prompt, signals, unmatched };
};
