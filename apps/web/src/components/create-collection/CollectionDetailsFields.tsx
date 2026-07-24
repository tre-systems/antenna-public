import { DESCRIPTION_MAX, TITLE_MAX } from './constants';

type Props = {
  readonly title: string;
  readonly description: string;
  readonly saving: boolean;
  readonly onTitleInputRef: (el: HTMLInputElement | null) => void;
  readonly onTitleChange: (value: string) => void;
  readonly onDescriptionChange: (value: string) => void;
};

export function CollectionDetailsFields({
  title,
  description,
  saving,
  onTitleInputRef,
  onTitleChange,
  onDescriptionChange,
}: Props) {
  return (
    <>
      <label class="block">
        <span class="text-xs font-medium text-slate-600 dark:text-slate-300">Title</span>
        <input
          ref={onTitleInputRef}
          type="text"
          value={title}
          maxLength={TITLE_MAX}
          disabled={saving}
          placeholder="e.g. Trading desk"
          onInput={(event) => {
            onTitleChange((event.target as HTMLInputElement).value);
          }}
          class="mt-1 block w-full rounded-md border border-slate-300 bg-white/90 px-2 py-1.5 text-sm text-slate-900 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/40 disabled:opacity-60 dark:border-white/15 dark:bg-white/[0.06] dark:text-white"
          data-testid="create-collection-title"
        />
      </label>
      <label class="block">
        <span class="text-xs font-medium text-slate-600 dark:text-slate-300">
          Description (optional)
        </span>
        <textarea
          value={description}
          maxLength={DESCRIPTION_MAX}
          disabled={saving}
          rows={2}
          onInput={(event) => {
            onDescriptionChange((event.target as HTMLTextAreaElement).value);
          }}
          class="mt-1 block w-full resize-none rounded-md border border-slate-300 bg-white/90 px-2 py-1.5 text-sm text-slate-700 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/40 disabled:opacity-60 dark:border-white/15 dark:bg-white/[0.06] dark:text-slate-200"
          data-testid="create-collection-description"
        />
      </label>
    </>
  );
}
