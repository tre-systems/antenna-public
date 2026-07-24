import { useEffect, useRef, useState } from 'preact/hooks';
import { submitPrompt } from '../api';
import { activeCollectionId } from '../signals/signals';
import { currentPlan, planError, planSubmitting } from '../signals/plan';
import { PlanPreview } from './PlanPreview';

const EXAMPLE_PROMPTS = [
  { label: 'CHF/USD', prompt: 'track CHF/USD' },
  { label: 'Paris weather', prompt: 'weather in Paris' },
  { label: 'vercel/next.js', prompt: 'github vercel/next.js' },
] as const;

type Props = {
  readonly open: boolean;
  readonly onConfirmed: (createdSignalIds: readonly string[]) => void;
  readonly onOpenChange: (open: boolean) => void;
  readonly offline?: boolean;
  readonly autoFocus?: boolean;
};

const CARD = 'antenna-panel rounded-2xl p-3 sm:p-4';

const INPUT =
  'h-11 w-full rounded-xl border-0 bg-white/80 px-3.5 text-sm text-slate-900 ring-1 ring-inset ring-slate-900/10 transition placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-emerald-500/60 disabled:bg-slate-100/60 disabled:text-slate-400 dark:bg-white/5 dark:text-slate-100 dark:ring-white/10 dark:placeholder:text-slate-500 dark:focus:ring-emerald-400/50 dark:disabled:bg-white/5 dark:disabled:text-slate-500';

const PRIMARY_BUTTON =
  'antenna-primary inline-flex h-11 items-center justify-center gap-1.5 rounded-xl px-5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50';

const SparkleIcon = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" class="h-3.5 w-3.5 opacity-90" aria-hidden="true">
    <path d="M8 1.5l1.4 3.7L13 6.5l-3.6 1.3L8 11.5 6.6 7.8 3 6.5l3.6-1.3L8 1.5zM12.5 10l.7 1.8L15 12.5l-1.8.7-.7 1.8-.7-1.8L10 12.5l1.8-.7.7-1.8z" />
  </svg>
);

export function SignalComposer({
  open,
  onConfirmed,
  onOpenChange,
  offline = false,
  autoFocus = false,
}: Props) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const submitting = planSubmitting.value;
  const error = planError.value;
  const hasPlan = currentPlan.value !== null;
  const expanded = open || hasPlan || submitting || error !== null;

  useEffect(() => {
    if (!autoFocus || offline) return;
    onOpenChange(true);
  }, [autoFocus, offline, onOpenChange]);

  useEffect(() => {
    if (offline || !expanded) return;
    inputRef.current?.focus();
  }, [expanded, offline]);

  const handleSubmit = async (event: Event) => {
    event.preventDefault();
    const prompt = value.trim();
    if (prompt.length === 0 || submitting || offline) return;
    planSubmitting.value = true;
    planError.value = null;
    try {
      const record = await submitPrompt(prompt, activeCollectionId.value ?? undefined);
      currentPlan.value = record;
      setValue('');
    } catch (err) {
      planError.value = err instanceof Error ? err.message : 'Failed to submit prompt.';
    } finally {
      planSubmitting.value = false;
    }
  };

  // Populate the input from an example chip and focus it so Enter submits.
  // We deliberately do not auto-submit — the value should be visible and
  // editable for a beat before the user commits.
  const handleExampleClick = (prompt: string): void => {
    setValue(prompt);
    inputRef.current?.focus();
  };

  const handleConfirmed = (createdSignalIds: readonly string[]): void => {
    onConfirmed(createdSignalIds);
    onOpenChange(false);
  };

  if (!expanded) return null;

  return (
    <section class={CARD}>
      <div class="mb-3 flex items-center justify-between gap-3">
        <p class="antenna-eyebrow">Add signal</p>
        {!hasPlan && !submitting ? (
          <button
            type="button"
            onClick={() => {
              onOpenChange(false);
            }}
            class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-900/10 transition hover:bg-white hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 dark:bg-white/[0.06] dark:text-slate-300 dark:ring-white/10 dark:hover:bg-white/[0.1] dark:hover:text-white"
            data-testid="signal-composer-collapse"
          >
            Hide
          </button>
        ) : null}
      </div>
      <form class="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]" onSubmit={handleSubmit}>
        <label class="flex-1">
          <span class="sr-only">Signal prompt</span>
          <input
            ref={inputRef}
            type="text"
            value={value}
            disabled={submitting || offline}
            onInput={(e) => {
              setValue((e.target as HTMLInputElement).value);
            }}
            placeholder={
              offline ? 'Reconnect before adding a new signal.' : 'What should Antenna track?'
            }
            class={INPUT}
            data-testid="signal-composer-input"
          />
        </label>
        <button
          type="submit"
          disabled={submitting || offline || value.trim().length === 0}
          class={PRIMARY_BUTTON}
          data-testid="signal-composer-submit"
        >
          {submitting ? null : <SparkleIcon />}
          {submitting ? 'Planning…' : 'Plan'}
        </button>
      </form>

      {error ? <p class="mt-3 text-xs italic text-rose-600 dark:text-rose-300">{error}</p> : null}
      {offline && !error ? (
        <p class="mt-3 text-xs italic text-amber-700 dark:text-amber-300">
          Offline — new signals need a live connection to the Worker.
        </p>
      ) : null}

      {currentPlan.value === null && !submitting ? (
        <p class="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <span>Try</span>
          {EXAMPLE_PROMPTS.map((example) => (
            <button
              key={example.prompt}
              type="button"
              onClick={() => {
                handleExampleClick(example.prompt);
              }}
              class="rounded-full bg-slate-900/[0.04] px-2.5 py-1 font-medium text-slate-700 transition-colors hover:bg-slate-900/[0.08] hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/60 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10 dark:hover:text-white"
              data-testid={`signal-composer-example-${example.prompt.replace(/[^a-z0-9]+/gi, '-')}`}
            >
              {example.label}
            </button>
          ))}
        </p>
      ) : null}

      <PlanPreview onConfirmed={handleConfirmed} />
    </section>
  );
}
