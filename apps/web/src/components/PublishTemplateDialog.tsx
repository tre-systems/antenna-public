import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { CollectionRecord, CollectionTemplatePublishRecord } from '../api';
import { publishCollectionTemplate } from '../api';
import { defaultSummary, publishTemplateErrorMessage } from './publish-template/copy';
import { PublishActions } from './publish-template/PublishActions';
import { PublishDialogHeader } from './publish-template/PublishDialogHeader';
import { PublishFields } from './publish-template/PublishFields';
import { PublishResult } from './publish-template/PublishResult';

export { humanSkippedReason, publishTemplateErrorMessage } from './publish-template/copy';

type Props = {
  readonly collection: CollectionRecord;
  readonly onClose: () => void;
};

export function PublishTemplateDialog({ collection, onClose }: Props) {
  const [label, setLabel] = useState(collection.title);
  const [description, setDescription] = useState(collection.description ?? '');
  const [summary, setSummary] = useState(defaultSummary(collection));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CollectionTemplatePublishRecord | null>(null);
  const labelRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    labelRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose, saving]);

  const trimmed = useMemo(
    () => ({
      label: label.trim(),
      description: description.trim(),
      summary: summary.trim(),
    }),
    [description, label, summary],
  );

  const submit = async () => {
    if (trimmed.label.length === 0) {
      setError('Label is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const next = await publishCollectionTemplate(collection.id, {
        label: trimmed.label,
        description: trimmed.description.length > 0 ? trimmed.description : null,
        ...(trimmed.summary.length > 0 ? { summary: trimmed.summary } : {}),
      });
      setResult(next);
    } catch (err) {
      setError(publishTemplateErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      class="fixed inset-0 z-30 flex items-end justify-center sm:items-center"
      data-testid="publish-template-dialog"
    >
      <button
        type="button"
        aria-label="Close publish template"
        onClick={onClose}
        disabled={saving}
        class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity disabled:cursor-wait dark:bg-black/60"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="publish-template-title"
        class="antenna-menu relative m-0 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl p-5 sm:m-4 sm:rounded-2xl"
      >
        <PublishDialogHeader saving={saving} onClose={onClose} />
        <PublishFields
          description={description}
          label={label}
          saving={saving}
          summary={summary}
          onDescriptionChange={setDescription}
          onLabelChange={setLabel}
          onLabelRef={(element) => {
            labelRef.current = element;
          }}
          onSummaryChange={setSummary}
        />

        {error ? (
          <p class="mt-3 text-xs text-rose-600 dark:text-rose-400" role="alert">
            {error}
          </p>
        ) : null}

        {result ? <PublishResult result={result} /> : null}

        <PublishActions
          canSubmit={trimmed.label.length > 0}
          hasResult={Boolean(result)}
          saving={saving}
          onClose={onClose}
          onSubmit={() => {
            void submit();
          }}
        />
      </div>
    </div>
  );
}
