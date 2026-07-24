import { useMemo, useState } from 'preact/hooks';
import { RIGHTS_STATUS_COPY, type ProposedSignal, type RightsStatus } from '@antenna/shared';
import { configKeyLabel } from '../configLabels';

type Props = {
  signal: ProposedSignal;
  index: number;
  onChange: (index: number, next: ProposedSignal) => void;
};

// Presentational only: the badge's Tailwind classes per rights status. The
// human label + tooltip copy is server-owned (RIGHTS_STATUS_COPY in
// @antenna/shared) so the wording stays in one place.
const RIGHTS_STYLES: Record<RightsStatus, string> = {
  public:
    'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/20',
  'with-attribution':
    'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-400/20',
  'requires-auth':
    'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/20',
  'needs-review':
    'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-400/20',
};

function stringifyConfigValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

function parseConfigValue(input: string, previous: unknown): unknown {
  if (typeof previous === 'number') {
    const n = Number(input);
    return Number.isFinite(n) ? n : input;
  }
  if (typeof previous === 'boolean') return input === 'true';
  return input;
}

export function PlanSignalRow({ signal, index, onChange }: Props) {
  const [editing, setEditing] = useState(false);
  const configEntries = useMemo(() => Object.entries(signal.config), [signal.config]);
  const missing = signal.missing;

  const setConfigField = (key: string, raw: string) => {
    const next: ProposedSignal = {
      ...signal,
      config: { ...signal.config, [key]: parseConfigValue(raw, signal.config[key]) },
    };
    onChange(index, next);
  };

  const setMissingField = (key: string, raw: string) => {
    const trimmed = raw.trim();
    const nextConfig = { ...signal.config, [key]: trimmed };
    const nextMissing = trimmed.length === 0 ? [...missing] : missing.filter((m) => m !== key);
    onChange(index, { ...signal, config: nextConfig, missing: nextMissing });
  };

  return (
    <li
      class="rounded-xl bg-white/40 p-4 ring-1 ring-slate-900/5 dark:bg-white/[0.03] dark:ring-white/10"
      data-testid="plan"
    >
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <h3 class="truncate text-sm font-semibold text-slate-900 dark:text-white">
            {signal.display_name}
          </h3>
          <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{signal.source_label}</p>
        </div>
        <span
          class={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${RIGHTS_STYLES[signal.rights_status]}`}
          title={RIGHTS_STATUS_COPY[signal.rights_status].tooltip}
          data-rights={signal.rights_status}
        >
          {RIGHTS_STATUS_COPY[signal.rights_status].label}
        </span>
      </div>

      {missing.length > 0 ? (
        <div class="mt-3 space-y-2" data-testid="plan-missing">
          {missing.map((key) => {
            const label = configKeyLabel(key);
            return (
              <label key={key} class="block text-xs">
                <span class="text-slate-600 dark:text-slate-300">{label}</span>
                <input
                  type="text"
                  placeholder={label}
                  aria-label={label}
                  onInput={(e) => {
                    setMissingField(key, (e.target as HTMLInputElement).value);
                  }}
                  class="mt-1 w-full rounded-md border-0 bg-white/70 px-2 py-1 text-sm text-slate-900 ring-1 ring-inset ring-amber-300/60 focus:ring-2 focus:ring-inset focus:ring-violet-500/60 dark:bg-white/5 dark:text-slate-100 dark:ring-amber-400/30 dark:focus:ring-violet-400/50"
                  data-testid={`plan-missing-${key}`}
                />
              </label>
            );
          })}
        </div>
      ) : null}

      {configEntries.length > 0 ? (
        <div class="mt-3">
          <div class="flex items-center justify-between">
            <p class="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">Config</p>
            <button
              type="button"
              class="text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              onClick={() => {
                setEditing((e) => !e);
              }}
            >
              {editing ? 'Done' : 'Edit'}
            </button>
          </div>
          <dl class="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            {configEntries.map(([k, v]) => (
              <div key={k} class="contents">
                <dt class="truncate text-slate-500 dark:text-slate-400">{configKeyLabel(k)}</dt>
                <dd class="font-mono text-slate-900 dark:text-slate-100">
                  {editing ? (
                    <input
                      type="text"
                      aria-label={`${configKeyLabel(k)} value`}
                      value={stringifyConfigValue(v)}
                      onInput={(e) => {
                        setConfigField(k, (e.target as HTMLInputElement).value);
                      }}
                      class="w-full rounded border-0 bg-white/70 px-1 py-0.5 text-xs ring-1 ring-inset ring-slate-900/10 focus:ring-2 focus:ring-inset focus:ring-violet-500/60 dark:bg-white/5 dark:ring-white/10 dark:focus:ring-violet-400/50"
                    />
                  ) : (
                    stringifyConfigValue(v)
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
    </li>
  );
}
