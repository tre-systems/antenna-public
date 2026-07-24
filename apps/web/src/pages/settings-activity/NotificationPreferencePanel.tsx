import type { NotificationPreferenceRecord } from '../../api';
import { relativeTime } from '../../relativeTime';
import type { PreferencePatch } from './types';

type Props = {
  readonly error: string | null;
  readonly preference: NotificationPreferenceRecord | null;
  readonly saving: boolean;
  readonly onChange: (patch: PreferencePatch) => void | Promise<void>;
};

export function NotificationPreferencePanel({ preference, saving, error, onChange }: Props) {
  const enabled = preference?.enabled ?? false;
  const frequency = preference?.frequency ?? 'daily';
  return (
    <section
      class="rounded-2xl bg-white/70 p-5 ring-1 ring-slate-900/5 backdrop-blur-xl dark:bg-white/[0.04] dark:ring-white/10"
      data-testid="activity-notifications"
    >
      <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div class="min-w-0">
          <h2 class="text-sm font-semibold text-slate-900 dark:text-white">Daily brief</h2>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Email brief for triggered signal alerts. Quiet hours are enforced server-side when
            configured.
          </p>
          <p class="mt-2 text-xs text-slate-400 dark:text-slate-500">
            {preference?.updated_at ? `Updated ${relativeTime(preference.updated_at)}` : 'Default'}
          </p>
        </div>
        <DigestToggle enabled={enabled} frequency={frequency} saving={saving} onChange={onChange} />
      </div>

      <FrequencyButtons
        enabled={enabled}
        frequency={frequency}
        saving={saving}
        onChange={onChange}
      />

      {error ? (
        <p class="mt-3 text-xs text-rose-600 dark:text-rose-300" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function DigestToggle({
  enabled,
  frequency,
  saving,
  onChange,
}: {
  readonly enabled: boolean;
  readonly frequency: PreferencePatch['frequency'];
  readonly saving: boolean;
  readonly onChange: (patch: PreferencePatch) => void | Promise<void>;
}) {
  return (
    <button
      type="button"
      disabled={saving}
      onClick={() => {
        void onChange({ enabled: !enabled, frequency });
      }}
      class={`inline-flex shrink-0 items-center justify-center rounded-lg px-3 py-1.5 text-xs font-medium ring-1 transition focus:outline-none focus:ring-2 focus:ring-sky-400/40 disabled:opacity-60 ${
        enabled
          ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 hover:bg-emerald-100 dark:bg-emerald-400/10 dark:text-emerald-200 dark:ring-emerald-400/20'
          : 'bg-white text-slate-600 ring-slate-900/10 hover:bg-slate-50 dark:bg-white/[0.06] dark:text-slate-200 dark:ring-white/10'
      }`}
      data-testid="activity-digest-toggle"
    >
      {saving ? 'Saving...' : enabled ? 'Brief on' : 'Brief off'}
    </button>
  );
}

function FrequencyButtons({
  enabled,
  frequency,
  saving,
  onChange,
}: {
  readonly enabled: boolean;
  readonly frequency: PreferencePatch['frequency'];
  readonly saving: boolean;
  readonly onChange: (patch: PreferencePatch) => void | Promise<void>;
}) {
  return (
    <div class="mt-4 flex flex-wrap gap-2" role="group" aria-label="Brief frequency">
      {(['daily', 'weekly'] as const).map((option) => (
        <button
          key={option}
          type="button"
          disabled={saving}
          aria-pressed={frequency === option}
          onClick={() => {
            void onChange({ enabled, frequency: option });
          }}
          class={`rounded-md px-3 py-1.5 text-xs font-medium ring-1 transition focus:outline-none focus:ring-2 focus:ring-sky-400/40 disabled:opacity-60 ${
            frequency === option
              ? 'bg-slate-900 text-white ring-slate-900 dark:bg-white dark:text-slate-900 dark:ring-white'
              : 'bg-white/70 text-slate-600 ring-slate-900/10 hover:bg-white dark:bg-white/[0.04] dark:text-slate-300 dark:ring-white/10'
          }`}
          data-testid={`activity-digest-frequency-${option}`}
        >
          {option === 'daily' ? 'Daily' : 'Weekly'}
        </button>
      ))}
    </div>
  );
}
