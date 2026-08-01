import { configKeyLabel } from '../../config-labels';
import { updateConfigDraft, type ConfigDraft } from './config-draft';

type ConfigEntry = readonly [string, string | number];

type ConfigFieldsetProps = {
  readonly entries: readonly ConfigEntry[];
  readonly draft: ConfigDraft;
  readonly disabled: boolean;
  readonly onDraftChange: (updater: (previous: ConfigDraft) => ConfigDraft) => void;
};

export function ConfigFieldset({ entries, draft, disabled, onDraftChange }: ConfigFieldsetProps) {
  if (entries.length === 0) return null;

  return (
    <fieldset class="block" data-testid="signal-settings-config">
      <legend class="text-xs font-medium text-slate-600 dark:text-slate-300">Configuration</legend>
      <div class="mt-1 space-y-2">
        {entries.map(([key, original]) => (
          <ConfigInput
            key={key}
            configKey={key}
            original={original}
            current={draft[key] ?? ''}
            disabled={disabled}
            onDraftChange={onDraftChange}
          />
        ))}
      </div>
      <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Validated server-side against the template's config schema. Invalid edits surface as an
        error below.
      </p>
    </fieldset>
  );
}

type ConfigInputProps = {
  readonly configKey: string;
  readonly original: string | number;
  readonly current: string | number;
  readonly disabled: boolean;
  readonly onDraftChange: (updater: (previous: ConfigDraft) => ConfigDraft) => void;
};

function ConfigInput({ configKey, original, current, disabled, onDraftChange }: ConfigInputProps) {
  const isNumber = typeof original === 'number';

  return (
    <label class="block">
      <span class="text-xs text-slate-500 dark:text-slate-400">{configKeyLabel(configKey)}</span>
      <input
        type={isNumber ? 'number' : 'text'}
        value={String(current)}
        disabled={disabled}
        onInput={(event) => {
          const raw = (event.target as HTMLInputElement).value;
          onDraftChange((previous) => updateConfigDraft(previous, configKey, original, raw));
        }}
        class="mt-1 block w-full rounded-md border border-slate-300 bg-white/90 px-2 py-1.5 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:opacity-60 dark:border-white/15 dark:bg-white/[0.06] dark:text-white"
        data-testid={`signal-settings-config-${configKey}`}
      />
    </label>
  );
}
