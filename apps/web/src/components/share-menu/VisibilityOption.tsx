import type { ComponentChildren } from 'preact';
import type { CollectionRecord } from '@antenna/shared';
import { CheckIcon, LinkIcon, LockIcon } from './icons';

type OptionDef = {
  readonly value: Exclude<CollectionRecord['visibility'], 'public'>;
  readonly label: string;
  readonly hint: string;
  readonly icon: () => ComponentChildren;
};

export const VISIBILITY_OPTIONS: readonly OptionDef[] = [
  {
    value: 'private',
    label: 'Private',
    hint: 'Only you can see this collection.',
    icon: LockIcon,
  },
  {
    value: 'shared',
    label: 'Shared',
    hint: 'Anyone with the link can view approved shared signals.',
    icon: LinkIcon,
  },
];

export function VisibilityOption({
  opt,
  active,
  busy,
  disabled,
  onSelect,
}: {
  readonly opt: OptionDef;
  readonly active: boolean;
  readonly busy: boolean;
  readonly disabled: boolean;
  readonly onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onSelect}
      class={`flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:opacity-60 ${
        active
          ? 'bg-emerald-50 dark:bg-emerald-400/10'
          : 'hover:bg-slate-900/[0.04] dark:hover:bg-white/5'
      }`}
      data-testid={`visibility-${opt.value}`}
    >
      <span class="mt-0.5 shrink-0 text-slate-500 dark:text-slate-400">{opt.icon()}</span>
      <span class="min-w-0 flex-1">
        <span class="flex items-center gap-1.5 text-sm font-medium text-slate-900 dark:text-white">
          {opt.label}
          {busy ? <span class="text-xs font-normal text-slate-400">Saving…</span> : null}
        </span>
        <span class="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{opt.hint}</span>
      </span>
      {active ? (
        <span class="mt-0.5 shrink-0 text-emerald-700 dark:text-emerald-300">
          <CheckIcon />
        </span>
      ) : null}
    </button>
  );
}
