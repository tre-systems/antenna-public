// The Worker clamps to 60..604800, so the dropdown mirrors that range.
const refreshOptions = [
  { value: 60, label: 'Every minute' },
  { value: 300, label: 'Every 5 minutes' },
  { value: 900, label: 'Every 15 minutes' },
  { value: 1800, label: 'Every 30 minutes' },
  { value: 3600, label: 'Every hour' },
  { value: 21600, label: 'Every 6 hours' },
  { value: 86400, label: 'Once a day' },
  { value: 604800, label: 'Once a week' },
] as const;

type RefreshCadenceFieldProps = {
  readonly initialRefresh: number;
  readonly pendingRefresh: number;
  readonly disabled: boolean;
  readonly onChange: (seconds: number) => void;
};

export function RefreshCadenceField({
  initialRefresh,
  pendingRefresh,
  disabled,
  onChange,
}: RefreshCadenceFieldProps) {
  const hasInitialPreset = refreshOptions.some((option) => option.value === initialRefresh);

  return (
    <label class="block">
      <span class="text-xs font-medium text-slate-600 dark:text-slate-300">Refresh cadence</span>
      <select
        value={String(pendingRefresh)}
        disabled={disabled}
        onChange={(event) => {
          onChange(Number((event.target as HTMLSelectElement).value));
        }}
        class="mt-1 block w-full rounded-md border border-slate-300 bg-white/90 px-2 py-1.5 text-sm text-slate-900 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/40 disabled:opacity-60 dark:border-white/15 dark:bg-white/[0.06] dark:text-white"
        data-testid="signal-settings-refresh"
      >
        {hasInitialPreset ? null : (
          <option value={String(initialRefresh)}>Current: {cadenceLabel(initialRefresh)}</option>
        )}
        {refreshOptions.map((option) => (
          <option key={option.value} value={String(option.value)}>
            {option.label}
          </option>
        ))}
      </select>
      <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
        How often the cron should refresh this signal.
      </p>
    </label>
  );
}

function cadenceLabel(seconds: number): string {
  const exact = refreshOptions.find((option) => option.value === seconds);
  if (exact) return exact.label;
  if (seconds < 60) return `${String(seconds)} s`;
  if (seconds < 3600) return `Every ${String(Math.round(seconds / 60))} minutes`;
  if (seconds < 86400) return `Every ${String(Math.round(seconds / 3600))} hours`;
  return `Every ${String(Math.round(seconds / 86400))} days`;
}
