import { useEffect, useRef, useState } from 'preact/hooks';
import type { CollectionRecord, CollectionTemplateRecord } from '../api';
import { createCollection, getCollectionTemplates } from '../api';
import { CreateCollectionActions } from './create-collection/CreateCollectionActions';
import { CollectionDetailsFields } from './create-collection/CollectionDetailsFields';
import { DialogHeader } from './create-collection/DialogHeader';
import { TemplatePicker } from './create-collection/TemplatePicker';
import type { TemplateState } from './create-collection/types';

type Props = {
  readonly onClose: () => void;
  readonly onCreated?: (record: CollectionRecord) => Promise<void> | void;
};

export { templateSignalSummary } from './create-collection/template-summary';

const collectionErrorMessage = (err: unknown, fallback: string): string =>
  err instanceof Error ? err.message : fallback;

// On success we land the browser on the new collection via a query-param
// URL so the SPA refetches its signals via getCollectionById(<newId>).
const navigateToCreated = (record: CollectionRecord): void => {
  if (typeof window === 'undefined') return;
  window.location.assign(`/?collection=${encodeURIComponent(record.id)}`);
};

export function CreateCollectionDialog({ onClose, onCreated }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [templateState, setTemplateState] = useState<TemplateState>({ kind: 'loading' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  useEffect(() => {
    const flag = { cancelled: false };
    void loadTemplates(flag, setTemplateState);
    return () => {
      flag.cancelled = true;
    };
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

  const applyTemplate = (template: CollectionTemplateRecord | null): void => {
    setSelectedTemplateId(template?.id ?? null);
    if (template && title.trim().length === 0) setTitle(template.label);
    if (template && description.trim().length === 0) setDescription(template.description);
  };

  const submit = async (): Promise<void> => {
    const trimmedTitle = title.trim();
    if (trimmedTitle.length === 0) {
      setError('Title is required.');
      return;
    }
    await createFromForm(trimmedTitle);
  };

  const createFromForm = async (trimmedTitle: string): Promise<void> => {
    setSaving(true);
    setError(null);
    try {
      const record = await createCollection(
        buildCollectionBody(trimmedTitle, description, selectedTemplateId),
      );
      await onCreated?.(record);
      navigateToCreated(record);
    } catch (err) {
      setError(collectionErrorMessage(err, 'Could not create collection.'));
      setSaving(false);
    }
  };

  return (
    <div
      class="fixed inset-0 z-30 flex items-end justify-center sm:items-center"
      data-testid="create-collection-dialog"
    >
      <button
        type="button"
        aria-label="Close create collection"
        onClick={onClose}
        class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity dark:bg-black/60"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-collection-title"
        class="antenna-menu relative m-0 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl p-5 sm:m-4 sm:rounded-2xl"
      >
        <DialogHeader onClose={onClose} />
        <div class="mt-5 space-y-4">
          <CollectionDetailsFields
            title={title}
            description={description}
            saving={saving}
            onTitleInputRef={(el) => {
              titleRef.current = el;
            }}
            onTitleChange={setTitle}
            onDescriptionChange={setDescription}
          />
          <TemplatePicker
            state={templateState}
            selectedId={selectedTemplateId}
            disabled={saving}
            onSelect={applyTemplate}
          />
        </div>
        {error ? (
          <p class="mt-3 text-xs text-rose-600 dark:text-rose-400" role="alert">
            {error}
          </p>
        ) : null}
        <CreateCollectionActions
          saving={saving}
          canSubmit={title.trim().length > 0}
          onCancel={onClose}
          onSubmit={submit}
        />
      </div>
    </div>
  );
}

const loadTemplates = async (
  flag: { readonly cancelled: boolean },
  setTemplateState: (state: TemplateState) => void,
): Promise<void> => {
  try {
    const data = await getCollectionTemplates();
    if (!flag.cancelled) setTemplateState({ kind: 'ready', templates: data.templates });
  } catch (err) {
    if (flag.cancelled) return;
    setTemplateState({
      kind: 'error',
      message: collectionErrorMessage(err, 'Could not load templates.'),
    });
  }
};

const buildCollectionBody = (
  title: string,
  description: string,
  templateId: string | null,
): Parameters<typeof createCollection>[0] => {
  const trimmedDescription = description.trim();
  return {
    title,
    ...(trimmedDescription.length > 0 ? { description: trimmedDescription } : {}),
    ...(templateId === null ? {} : { template_id: templateId }),
  };
};
