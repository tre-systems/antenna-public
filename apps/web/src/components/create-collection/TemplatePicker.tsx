import type { CollectionTemplateRecord } from '../../api';
import { templateSignalSummary } from './template-summary';
import { templateButtonClass, templatePillClass } from './template-styles';
import type { TemplateState } from './types';

type Props = {
  readonly state: TemplateState;
  readonly selectedId: string | null;
  readonly disabled: boolean;
  readonly onSelect: (template: CollectionTemplateRecord | null) => void;
};

export function TemplatePicker({ state, selectedId, disabled, onSelect }: Props) {
  return (
    <section aria-labelledby="create-collection-template-title">
      <TemplatePickerHeading state={state} />
      <div class="mt-2 grid gap-2">
        <BlankTemplateButton
          selected={selectedId === null}
          disabled={disabled}
          onSelect={onSelect}
        />
        {state.kind === 'ready'
          ? state.templates.map((template) => (
              <TemplateButton
                key={template.id}
                template={template}
                selected={selectedId === template.id}
                disabled={disabled}
                onSelect={onSelect}
              />
            ))
          : null}
      </div>
      <TemplatePickerError state={state} />
      <TemplatePickerFootnote selectedId={selectedId} />
    </section>
  );
}

function TemplatePickerHeading({ state }: { readonly state: TemplateState }) {
  return (
    <div class="flex items-baseline justify-between gap-3">
      <h3
        id="create-collection-template-title"
        class="text-xs font-medium text-slate-600 dark:text-slate-300"
      >
        Start from
      </h3>
      {state.kind === 'loading' ? (
        <span class="text-[0.7rem] text-slate-400 dark:text-slate-500">Loading templates...</span>
      ) : null}
    </div>
  );
}

function BlankTemplateButton({
  selected,
  disabled,
  onSelect,
}: {
  readonly selected: boolean;
  readonly disabled: boolean;
  readonly onSelect: (template: null) => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={selected}
      onClick={() => {
        onSelect(null);
      }}
      class={templateButtonClass(selected)}
      data-testid="create-collection-template-blank"
    >
      <span class="min-w-0">
        <span class="block text-sm font-medium text-slate-900 dark:text-white">Blank</span>
        <span class="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
          Start private and add signals when you need them.
        </span>
      </span>
      <span class={templatePillClass(selected)}>{selected ? 'Selected' : 'Blank'}</span>
    </button>
  );
}

function TemplateButton({
  template,
  selected,
  disabled,
  onSelect,
}: {
  readonly template: CollectionTemplateRecord;
  readonly selected: boolean;
  readonly disabled: boolean;
  readonly onSelect: (template: CollectionTemplateRecord) => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={selected}
      onClick={() => {
        onSelect(template);
      }}
      class={templateButtonClass(selected)}
      data-testid={`create-collection-template-${template.id}`}
    >
      <span class="min-w-0">
        <span class="flex flex-wrap items-center gap-2">
          <span class="text-sm font-medium text-slate-900 dark:text-white">{template.label}</span>
          <span class="rounded-full bg-slate-100 px-1.5 py-0.5 text-[0.65rem] font-medium uppercase text-slate-500 dark:bg-white/10 dark:text-slate-300">
            {template.kind}
          </span>
        </span>
        <span class="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
          {template.summary}
        </span>
        <span class="mt-1 block text-[0.7rem] text-slate-400 dark:text-slate-500">
          {templateSignalSummary(template)}
        </span>
      </span>
      <span class={templatePillClass(selected)}>{selected ? 'Selected' : 'Use'}</span>
    </button>
  );
}

function TemplatePickerError({ state }: { readonly state: TemplateState }) {
  if (state.kind !== 'error') return null;
  return (
    <p class="mt-2 text-xs text-amber-700 dark:text-amber-300">
      Templates are unavailable right now, so this collection will start blank. {state.message}
    </p>
  );
}

function TemplatePickerFootnote({ selectedId }: { readonly selectedId: string | null }) {
  if (selectedId !== null) {
    return (
      <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">
        Template collections start private. You can share a collection link after choosing which
        signals are safe to include.
      </p>
    );
  }
  return (
    <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">
      New collections start private. You can flip visibility and add signals once you land on it.
    </p>
  );
}
