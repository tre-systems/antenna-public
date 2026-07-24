import { DESCRIPTION_MAX, LABEL_MAX, SUMMARY_MAX } from './constants';

type Props = {
  readonly description: string;
  readonly label: string;
  readonly saving: boolean;
  readonly summary: string;
  readonly onDescriptionChange: (value: string) => void;
  readonly onLabelChange: (value: string) => void;
  readonly onLabelRef: (element: HTMLInputElement | null) => void;
  readonly onSummaryChange: (value: string) => void;
};

export function PublishFields({
  description,
  label,
  saving,
  summary,
  onDescriptionChange,
  onLabelChange,
  onLabelRef,
  onSummaryChange,
}: Props) {
  return (
    <div class="mt-5 space-y-4">
      <label class="block">
        <span class="text-xs font-medium text-slate-600 dark:text-slate-300">Label</span>
        <input
          ref={onLabelRef}
          type="text"
          value={label}
          maxLength={LABEL_MAX}
          disabled={saving}
          onInput={(event) => {
            onLabelChange((event.target as HTMLInputElement).value);
          }}
          class="mt-1 block w-full rounded-md border border-slate-300 bg-white/90 px-2 py-1.5 text-sm text-slate-900 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/40 disabled:opacity-60 dark:border-white/15 dark:bg-white/[0.06] dark:text-white"
          data-testid="publish-template-label"
        />
      </label>
      <label class="block">
        <span class="text-xs font-medium text-slate-600 dark:text-slate-300">Description</span>
        <textarea
          value={description}
          maxLength={DESCRIPTION_MAX}
          disabled={saving}
          rows={2}
          onInput={(event) => {
            onDescriptionChange((event.target as HTMLTextAreaElement).value);
          }}
          class="mt-1 block w-full resize-none rounded-md border border-slate-300 bg-white/90 px-2 py-1.5 text-sm text-slate-700 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/40 disabled:opacity-60 dark:border-white/15 dark:bg-white/[0.06] dark:text-slate-200"
          data-testid="publish-template-description"
        />
      </label>
      <label class="block">
        <span class="text-xs font-medium text-slate-600 dark:text-slate-300">Summary</span>
        <input
          type="text"
          value={summary}
          maxLength={SUMMARY_MAX}
          disabled={saving}
          onInput={(event) => {
            onSummaryChange((event.target as HTMLInputElement).value);
          }}
          class="mt-1 block w-full rounded-md border border-slate-300 bg-white/90 px-2 py-1.5 text-sm text-slate-900 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/40 disabled:opacity-60 dark:border-white/15 dark:bg-white/[0.06] dark:text-white"
          data-testid="publish-template-summary"
        />
      </label>
    </div>
  );
}
