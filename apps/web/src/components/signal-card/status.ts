import type { DerivedStatus } from '../../signalStatus';
import type { CardStatus } from './types';

const SETUP_REQUIRED_PREFIX = 'setup_required:';

export const PILL_STYLES: Record<CardStatus, string> = {
  live: 'bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/20',
  loading:
    'animate-pulse bg-slate-100 text-slate-600 ring-slate-200 dark:bg-white/5 dark:text-slate-300 dark:ring-white/10',
  stale:
    'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/20',
  setup:
    'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/20',
  error:
    'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-400/20',
};

export const PILL_TOOLTIPS: Record<CardStatus, string> = {
  live: 'Fresh data — last fetched within the refresh interval',
  loading: 'Waiting for the first successful fetch',
  stale: 'Last successful fetch is older than expected — the next tick should refresh it',
  setup: 'This source needs setup before it can load — see the note below',
  error: 'Last fetch failed — hover the error message for details',
};

export const PILL_LABELS: Record<CardStatus, string> = {
  live: 'live',
  loading: 'loading',
  stale: 'stale',
  setup: 'needs setup',
  error: 'error',
};

type SetupCopy = {
  readonly title: string;
  readonly detail: string;
};

export function presentationStatus(status: DerivedStatus, lastError: string | null): CardStatus {
  if (status === 'error' && lastError !== null && lastError.startsWith(SETUP_REQUIRED_PREFIX)) {
    return 'setup';
  }
  return status;
}

export function strippedError(lastError: string): string {
  return lastError.startsWith(SETUP_REQUIRED_PREFIX)
    ? lastError.slice(SETUP_REQUIRED_PREFIX.length).trim()
    : lastError;
}

export function setupCopy(lastError: string, source: string): SetupCopy {
  const message = strippedError(lastError);
  return (
    secretSetupCopy(message, source) ??
    sourcePolicySetupCopy(message, source) ??
    runnerSetupCopy(message, source) ??
    publicDisplaySetupCopy(message, source) ?? {
      title: `${source} needs setup.`,
      detail: message,
    }
  );
}

export function friendlyError(lastError: string): string {
  return (
    httpFetchError(lastError) ??
    transportFetchError(lastError) ??
    rateLimitError(lastError) ??
    parseError(lastError) ??
    authError(lastError) ??
    configError(lastError) ??
    'Last refresh failed — this signal will retry'
  );
}

function secretSetupCopy(message: string, source: string): SetupCopy | null {
  const secret = secretName(message);
  return secret
    ? {
        title: `${source} needs a server secret.`,
        detail: `Add ${secret} in Cloudflare Workers, then wait for the next scheduled refresh.`,
      }
    : null;
}

function sourcePolicySetupCopy(message: string, source: string): SetupCopy | null {
  if (/missing source policy/i.test(message)) {
    return {
      title: 'This signal needs source review.',
      detail:
        'Choose a reviewed connector or add source-policy metadata before cloud refresh runs.',
    };
  }
  if (/requires source review/i.test(message)) {
    return {
      title: `${source} needs source review.`,
      detail:
        'Keep this signal private until the source policy is reviewed and marked safe to refresh.',
    };
  }
  return null;
}

function runnerSetupCopy(message: string, source: string): SetupCopy | null {
  if (!/runs user-side/i.test(message)) return null;
  return {
    title: `${source} needs a private runner.`,
    detail:
      'Cloud refresh cannot fetch this source; connect a user-side runner or use another source.',
  };
}

function publicDisplaySetupCopy(message: string, source: string): SetupCopy | null {
  if (!/cannot refresh externally visible signal/i.test(message)) return null;
  return {
    title: `${source} cannot refresh while shared or public.`,
    detail: 'Make the collection and signal private, or switch to a public-cloud source.',
  };
}

function httpFetchError(lastError: string): string | null {
  const httpMatch = /^fetch_failed:\s*HTTP\s*(\d{3})/i.exec(lastError);
  return httpMatch ? httpStatusError(Number(httpMatch[1])) : null;
}

function httpStatusError(status: number): string {
  if (status >= 500) return `Source is down (${String(status)}) — will retry`;
  if (status === 429) return 'Rate limited by source — will retry';
  if (status === 404) return 'Source returned not-found (404)';
  if (status === 401 || status === 403) {
    return `Source rejected the credentials (${String(status)}) — reconnect auth or update the server secret`;
  }
  return `Source returned an error (${String(status)})`;
}

function transportFetchError(lastError: string): string | null {
  if (!lastError.startsWith('fetch_failed:')) return null;
  return `Couldn't reach the source — will retry${suffixAfter(lastError, 'fetch_failed:')}`;
}

function rateLimitError(lastError: string): string | null {
  if (!lastError.startsWith('rate_limited')) return null;
  if (/github/i.test(lastError)) {
    return 'GitHub API rate limit hit — add GITHUB_TOKEN or wait for retry';
  }
  return 'Rate limited by source — will retry';
}

function parseError(lastError: string): string | null {
  if (!lastError.startsWith('parse_failed')) return null;
  return `Source response changed format — connector needs review${suffixAfter(
    lastError,
    'parse_failed:',
  )}`;
}

function authError(lastError: string): string | null {
  return lastError.startsWith('unauthorized')
    ? 'Credentials expired or were rejected — reconnect auth or update the server secret'
    : null;
}

function configError(lastError: string): string | null {
  if (lastError.startsWith('invalid_config:'))
    return 'This signal configuration is invalid — open settings';
  if (lastError.startsWith('unknown template')) return 'This signal type is no longer installed';
  return null;
}

function suffixAfter(msg: string, prefix: string): string {
  if (!msg.startsWith(prefix)) return '';
  const rest = msg.slice(prefix.length).trim();
  return rest.length > 0 ? ` (${rest})` : '';
}

const secretName = (message: string): string | null =>
  /\b[A-Z][A-Z0-9_]{4,}\b/.exec(message)?.[0] ?? null;
