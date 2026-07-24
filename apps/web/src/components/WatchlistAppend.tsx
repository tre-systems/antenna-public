import { useEffect, useRef, useState } from 'preact/hooks';
import type { ApiSignal } from '../api';
import { updateSignal } from '../api';
import { loadSignals } from '../signals/signals';

type Props = { readonly signal: ApiSignal };

// Inline "+ Add symbol" affordance for crypto-watchlist and equity-watchlist
// signals. Reads the current comma-joined list from config, validates the
// user's entry against a coarse template-aware shape, and PATCHes the merged
// list back. Tighter syntax (e.g. exchange suffixes) stays with the user —
// the server's Zod schema is the source of truth.
export function WatchlistAppend({ signal }: Props) {
  const cfg = appendConfig(signal);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  if (!cfg) return null;

  const cancel = () => {
    setDraft('');
    setEditing(false);
    setError(null);
  };

  const commit = async () => {
    const raw = draft.trim();
    if (!raw) {
      cancel();
      return;
    }
    const normalised = cfg.normalise(raw);
    if (!cfg.isValid(normalised)) {
      setError(cfg.invalidHint);
      return;
    }
    const existing = cfg.split();
    if (existing.some((entry) => entry.toLowerCase() === normalised.toLowerCase())) {
      setError('Already in this watchlist.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateSignal(signal.id, {
        config: { ...signal.config, [cfg.field]: [...existing, normalised].join(',') },
      });
      await loadSignals();
      setDraft('');
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add symbol.');
    } finally {
      setSaving(false);
    }
  };

  const handleKey = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void commit();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      cancel();
    }
  };

  return (
    <div class="mt-3" data-testid={`watchlist-append-${signal.id}`}>
      {editing ? (
        <div class="flex items-center gap-2">
          <input
            ref={(el) => {
              inputRef.current = el;
            }}
            type="text"
            aria-label={cfg.placeholder}
            placeholder={cfg.placeholder}
            value={draft}
            disabled={saving}
            onInput={(event) => {
              setDraft((event.target as HTMLInputElement).value);
            }}
            onKeyDown={handleKey}
            class="min-w-0 flex-1 rounded-md border border-slate-300 bg-white/90 px-2 py-1 text-xs text-slate-900 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/40 disabled:opacity-60 dark:border-white/15 dark:bg-white/[0.06] dark:text-white"
            data-testid={`watchlist-append-input-${signal.id}`}
          />
          <button
            type="button"
            onClick={() => {
              void commit();
            }}
            disabled={saving}
            class="rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white transition-colors hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-sky-400/40 disabled:opacity-60 dark:bg-white dark:text-slate-900"
          >
            {saving ? 'Adding…' : 'Add'}
          </button>
          <button
            type="button"
            onClick={cancel}
            disabled={saving}
            class="rounded-md px-2 py-1 text-xs text-slate-500 transition-colors hover:bg-slate-900/[0.05] focus:outline-none focus:ring-2 focus:ring-sky-400/40 disabled:opacity-60 dark:text-slate-400 dark:hover:bg-white/5"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setEditing(true);
          }}
          class="text-xs font-medium text-slate-500 transition-colors hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-400/40 dark:text-slate-400 dark:hover:text-slate-200"
          data-testid={`watchlist-append-trigger-${signal.id}`}
        >
          + Add {cfg.unitLabel}
        </button>
      )}
      {error ? (
        <p class="mt-1 text-xs text-rose-600 dark:text-rose-400" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type AppendConfig = {
  readonly field: 'pairs' | 'tickers';
  readonly unitLabel: string;
  readonly placeholder: string;
  readonly invalidHint: string;
  readonly split: () => string[];
  readonly normalise: (raw: string) => string;
  readonly isValid: (entry: string) => boolean;
};

const splitList = (value: unknown): string[] => {
  if (typeof value !== 'string') return [];
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
};

export function appendConfig(signal: ApiSignal): AppendConfig | null {
  if (signal.template_id === 'crypto-watchlist') {
    return {
      field: 'pairs',
      unitLabel: 'pair',
      placeholder: 'SOL or SOL-USD',
      invalidHint: 'Use a coin symbol like SOL or SOL-USD.',
      split: () => splitList(signal.config.pairs),
      // Bare ticker (SOL) → SOL-USD; let -USD pass through unchanged.
      normalise: (raw) => {
        const upper = raw.trim().toUpperCase();
        return /-USD$/.test(upper) ? upper : `${upper}-USD`;
      },
      isValid: (entry) => /^[A-Z0-9]{2,10}-USD$/.test(entry),
    };
  }
  if (signal.template_id === 'equity-watchlist') {
    return {
      field: 'tickers',
      unitLabel: 'ticker',
      placeholder: 'AAPL.US or AZN.UK',
      invalidHint: 'Use a Stooq ticker like AAPL.US or AZN.UK.',
      split: () => splitList(signal.config.tickers),
      normalise: (raw) => raw.trim().toUpperCase(),
      isValid: (entry) => /^[A-Z0-9.]{2,16}$/.test(entry) && /\.[A-Z]{1,3}$/.test(entry),
    };
  }
  return null;
}
