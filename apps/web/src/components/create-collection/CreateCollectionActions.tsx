type Props = {
  readonly saving: boolean;
  readonly canSubmit: boolean;
  readonly onCancel: () => void;
  readonly onSubmit: () => Promise<void> | void;
};

export function CreateCollectionActions({ saving, canSubmit, onCancel, onSubmit }: Props) {
  return (
    <div class="mt-5 flex items-center justify-end gap-2">
      <button
        type="button"
        onClick={onCancel}
        disabled={saving}
        class="rounded-md px-3 py-1.5 text-xs text-slate-600 transition-colors hover:bg-slate-900/[0.04] focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:opacity-60 dark:text-slate-300 dark:hover:bg-white/5"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={() => {
          void onSubmit();
        }}
        disabled={saving || !canSubmit}
        class="antenna-primary rounded-md px-3 py-1.5 text-xs font-semibold transition disabled:opacity-60"
        data-testid="create-collection-submit"
      >
        {saving ? 'Creating…' : 'Create collection'}
      </button>
    </div>
  );
}
