import type { TemplateRecord } from '@antenna/shared';
import { useEffect, useState } from 'preact/hooks';
import { submitPrompt, submitTemplate } from '../api';
import {
  currentPlan,
  isCurrentPlanState,
  planError,
  planStateVersion,
  planSubmitting,
} from '../signals/plan';
import { activeCollectionId } from '../signals/signals';
import { PlanPreview } from './PlanPreview';
import { useEscapeDismiss } from './dialog/use-escape-dismiss';
import { ComposerStart } from './signal-composer/ComposerStart';
import { SourceBrowser } from './signal-composer/SourceBrowser';
import type { SignalComposerProps, SignalComposerView } from './signal-composer/types';

export function SignalComposer({
  open,
  onConfirmed,
  onOpenChange,
  offline = false,
  autoFocus = false,
}: SignalComposerProps) {
  const [view, setView] = useState<SignalComposerView>('start');
  const [value, setValue] = useState('');
  const submitting = planSubmitting.value;
  const error = planError.value;
  const plan = currentPlan.value;
  const visible = open || plan !== null || submitting || error !== null;

  const close = (): void => {
    setView('start');
    setValue('');
    planError.value = null;
    onOpenChange(false);
  };

  useEffect(() => {
    if (autoFocus && !offline) onOpenChange(true);
  }, [autoFocus, offline, onOpenChange]);

  useEscapeDismiss(visible && plan === null && !submitting, close);

  const createPlan = async (request: () => ReturnType<typeof submitPrompt>): Promise<void> => {
    if (planSubmitting.value || offline) return;
    const version = planStateVersion();
    planSubmitting.value = true;
    planError.value = null;
    try {
      const next = await request();
      if (!isCurrentPlanState(version)) return;
      currentPlan.value = next;
      setValue('');
    } catch (err) {
      if (!isCurrentPlanState(version)) return;
      planError.value = err instanceof Error ? err.message : 'Could not review this request.';
    } finally {
      if (isCurrentPlanState(version)) planSubmitting.value = false;
    }
  };

  const submitManual = (event: Event): void => {
    event.preventDefault();
    const prompt = value.trim();
    if (prompt.length === 0) return;
    void createPlan(() => submitPrompt(prompt, activeCollectionId.value ?? undefined));
  };

  const selectTemplate = (template: TemplateRecord): void => {
    if (template.id === 'weather' || template.id === 'airquality') {
      setView('start');
      setValue(`${template.display_name.toLowerCase()} in `);
      return;
    }
    void createPlan(() => submitTemplate(template.id, activeCollectionId.value ?? undefined));
  };

  if (!visible) return null;

  return (
    <div class="fixed inset-0 z-30 flex justify-end">
      <button
        type="button"
        aria-label="Close track something"
        onClick={close}
        disabled={plan !== null || submitting}
        class="absolute inset-0 bg-slate-950/35 backdrop-blur-sm dark:bg-black/60"
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="track-something-title"
        class="antenna-menu relative h-full w-full max-w-lg overflow-y-auto border-l border-slate-900/10 p-4 shadow-2xl sm:p-5 dark:border-white/10"
      >
        <header class="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2
              id="track-something-title"
              class="text-lg font-semibold text-slate-900 dark:text-white"
            >
              {plan === null
                ? view === 'sources'
                  ? 'Choose a source'
                  : 'Track something'
                : 'Review addition'}
            </h2>
            <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {plan === null
                ? view === 'sources'
                  ? 'Select a reviewed connector; you’ll provide any required details next.'
                  : 'Describe a signal or choose a reviewed source.'
                : 'Check the source and details before adding it to your collection.'}
            </p>
          </div>
          {plan === null && !submitting ? (
            <button
              type="button"
              onClick={close}
              aria-label="Close track something"
              class="flex h-8 w-8 items-center justify-center rounded-lg text-lg text-slate-500 transition hover:bg-slate-900/5 hover:text-slate-900 dark:hover:bg-white/10 dark:hover:text-white"
              data-testid="signal-composer-collapse"
            >
              ×
            </button>
          ) : null}
        </header>

        {plan !== null ? (
          <PlanPreview
            key={plan.id}
            onConfirmed={(ids) => {
              onConfirmed(ids);
              close();
            }}
          />
        ) : null}
        {plan === null && view === 'start' ? (
          <ComposerStart
            busy={submitting}
            offline={offline}
            value={value}
            onBrowseSources={() => {
              setView('sources');
            }}
            onChange={setValue}
            onSubmit={submitManual}
          />
        ) : null}
        {plan === null && view === 'sources' ? (
          <SourceBrowser
            busy={submitting}
            onBack={() => {
              setView('start');
            }}
            onSelect={selectTemplate}
          />
        ) : null}
        {submitting ? <p class="mt-4 text-sm text-slate-500">Preparing addition…</p> : null}
        {error ? (
          <p class="mt-4 text-sm text-rose-600 dark:text-rose-300" role="alert">
            {error}
          </p>
        ) : null}
        {offline && !error ? (
          <p class="mt-4 text-xs text-amber-700 dark:text-amber-300">
            Reconnect before changing this collection.
          </p>
        ) : null}
      </section>
    </div>
  );
}
