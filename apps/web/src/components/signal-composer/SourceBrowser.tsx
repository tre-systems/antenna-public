import type { TemplateRecord } from '@antenna/shared';
import { useEffect, useState } from 'preact/hooks';
import { getTemplates } from '../../api';
import { templateButtonClass } from '../create-collection/template-styles';

type Props = {
  readonly busy: boolean;
  readonly onBack: () => void;
  readonly onSelect: (template: TemplateRecord) => void;
};

export function SourceBrowser({ busy, onBack, onSelect }: Props) {
  const [templates, setTemplates] = useState<readonly TemplateRecord[] | null>();
  const [query, setQuery] = useState('');

  useEffect(() => {
    void getTemplates()
      .then((records) => {
        setTemplates(records.filter((record) => record.planner_enabled));
      })
      .catch(() => {
        setTemplates(null);
      });
  }, []);

  const visibleTemplates = templates?.filter((template) => matchesQuery(template, query));

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        class="antenna-control mb-3 rounded-lg px-2 py-1 text-xs font-medium"
      >
        ← Back
      </button>
      <label class="sr-only" for="source-search">
        Search reviewed sources
      </label>
      <input
        id="source-search"
        type="search"
        value={query}
        autoFocus
        onInput={(event) => {
          setQuery((event.target as HTMLInputElement).value);
        }}
        placeholder="Search sources"
        class="antenna-control mb-3 h-10 w-full rounded-xl px-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
        data-testid="track-source-search"
      />
      <div class="max-h-[70vh] space-y-2 overflow-y-auto pr-1">
        {templates === undefined ? (
          <p class="py-5 text-center text-sm text-slate-500">Loading sources…</p>
        ) : null}
        {templates === null ? (
          <p role="alert" class="py-3 text-sm text-rose-600 dark:text-rose-300">
            Sources are unavailable.
          </p>
        ) : null}
        {visibleTemplates?.length === 0 ? (
          <p class="py-5 text-center text-sm text-slate-500 dark:text-slate-400">
            No reviewed sources match that search.
          </p>
        ) : null}
        {visibleTemplates?.map((template) => (
          <button
            key={template.id}
            type="button"
            disabled={busy}
            onClick={() => {
              onSelect(template);
            }}
            class={templateButtonClass(false)}
            data-testid={`track-source-${template.id}`}
          >
            <span class="min-w-0">
              <span class="block truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                {template.display_name}
              </span>
              {template.source_policy?.label ? (
                <span class="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">
                  {template.source_policy.label}
                </span>
              ) : null}
            </span>
            {template.setup_message ? (
              <span class="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[0.65rem] font-medium text-amber-700 dark:bg-amber-400/10 dark:text-amber-300">
                Needs setup
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}

export const matchesQuery = (template: TemplateRecord, query: string): boolean => {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [template.display_name, template.id, template.source_policy?.label]
    .filter((value): value is string => value !== undefined)
    .some((value) => value.toLowerCase().includes(needle));
};
