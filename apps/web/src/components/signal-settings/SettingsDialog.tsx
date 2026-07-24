import type { ComponentChildren } from 'preact';

type SettingsDialogProps = {
  readonly signalId: string;
  readonly title: string;
  readonly saving: boolean;
  readonly dirty: boolean;
  readonly error: string | null;
  readonly onClose: () => void;
  readonly onSave: () => Promise<void>;
  readonly children: ComponentChildren;
};

export function SettingsDialog({
  signalId,
  title,
  saving,
  dirty,
  error,
  onClose,
  onSave,
  children,
}: SettingsDialogProps) {
  return (
    <div
      class="fixed inset-0 z-30 flex items-end justify-center sm:items-center"
      data-testid="signal-settings-panel"
    >
      <button
        type="button"
        aria-label="Close settings"
        onClick={onClose}
        class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity dark:bg-black/60"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`signal-settings-title-${signalId}`}
        class="antenna-menu relative m-0 max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-t-2xl p-5 sm:m-4 sm:rounded-2xl"
      >
        <DialogHeader signalId={signalId} title={title} onClose={onClose} />
        {children}
        {error ? (
          <p class="mt-3 text-xs text-rose-600 dark:text-rose-400" role="alert">
            {error}
          </p>
        ) : null}
        <DialogActions saving={saving} dirty={dirty} onClose={onClose} onSave={onSave} />
      </div>
    </div>
  );
}

type DialogHeaderProps = {
  readonly signalId: string;
  readonly title: string;
  readonly onClose: () => void;
};

function DialogHeader({ signalId, title, onClose }: DialogHeaderProps) {
  return (
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h2
          id={`signal-settings-title-${signalId}`}
          class="truncate text-base font-semibold text-slate-900 dark:text-white"
        >
          {title}
        </h2>
        <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Signal settings</p>
      </div>
      <CloseButton onClose={onClose} />
    </div>
  );
}

function CloseButton({ onClose }: Pick<DialogHeaderProps, 'onClose'>) {
  return (
    <button
      type="button"
      aria-label="Close"
      onClick={onClose}
      class="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-900/[0.04] hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 dark:hover:bg-white/5 dark:hover:text-slate-200"
      data-testid="signal-settings-close"
    >
      <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" class="h-4 w-4">
        <path d="M3.7 2.7a1 1 0 0 1 1.4 0L8 5.6l2.9-2.9a1 1 0 1 1 1.4 1.4L9.4 7l2.9 2.9a1 1 0 1 1-1.4 1.4L8 8.4l-2.9 2.9a1 1 0 1 1-1.4-1.4L6.6 7 3.7 4.1a1 1 0 0 1 0-1.4Z" />
      </svg>
    </button>
  );
}

type DialogActionsProps = {
  readonly saving: boolean;
  readonly dirty: boolean;
  readonly onClose: () => void;
  readonly onSave: () => Promise<void>;
};

function DialogActions({ saving, dirty, onClose, onSave }: DialogActionsProps) {
  return (
    <div class="mt-5 flex items-center justify-end gap-2">
      <button
        type="button"
        onClick={onClose}
        disabled={saving}
        class="rounded-md px-3 py-1.5 text-xs text-slate-600 transition-colors hover:bg-slate-900/[0.04] focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:opacity-60 dark:text-slate-300 dark:hover:bg-white/5"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={() => {
          void onSave();
        }}
        disabled={saving || !dirty}
        class="antenna-primary rounded-md px-3 py-1.5 text-xs font-semibold transition disabled:opacity-60"
        data-testid="signal-settings-save"
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  );
}
