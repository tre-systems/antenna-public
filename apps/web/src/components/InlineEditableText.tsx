import { useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';

type Props = {
  readonly value: string;
  readonly placeholder: string;
  readonly maxLength: number;
  readonly ariaLabel: string;
  readonly onSave: (next: string) => Promise<void>;
  readonly allowEmpty?: boolean;
  readonly multiline?: boolean;
  readonly displayClass: string;
  readonly inputClass: string;
  readonly testidPrefix: string;
  readonly renderDisplay?: (text: string) => ComponentChildren;
};

// Click to edit; Enter or blur commits, Escape cancels.
export function InlineEditableText({
  value,
  placeholder,
  maxLength,
  ariaLabel,
  onSave,
  allowEmpty = false,
  multiline = false,
  displayClass,
  inputClass,
  testidPrefix,
  renderDisplay,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const commitInFlight = useRef(false);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = async () => {
    if (commitInFlight.current) return;
    const next = draft.trim();
    if (!allowEmpty && next.length === 0) {
      setError(`${ariaLabel} is required.`);
      return;
    }
    if (next === value) {
      setEditing(false);
      setError(null);
      return;
    }
    commitInFlight.current = true;
    setSaving(true);
    setError(null);
    try {
      await onSave(next);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not save ${ariaLabel.toLowerCase()}.`);
    } finally {
      commitInFlight.current = false;
      setSaving(false);
    }
  };

  const cancel = () => {
    setDraft(value);
    setEditing(false);
    setError(null);
  };

  const handleKey = (event: KeyboardEvent) => {
    // Multiline fields keep Shift+Enter for newlines; bare Enter still commits.
    if (event.key === 'Enter' && !(multiline && event.shiftKey)) {
      event.preventDefault();
      void commit();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      cancel();
    }
  };

  if (editing) {
    return (
      <>
        {multiline ? (
          <textarea
            ref={(el) => {
              inputRef.current = el;
            }}
            aria-label={ariaLabel}
            value={draft}
            maxLength={maxLength}
            disabled={saving}
            rows={2}
            onInput={(event) => {
              setDraft((event.target as HTMLTextAreaElement).value);
            }}
            onKeyDown={handleKey}
            onBlur={() => {
              void commit();
            }}
            class={inputClass}
            data-testid={`${testidPrefix}-input`}
          />
        ) : (
          <input
            ref={(el) => {
              inputRef.current = el;
            }}
            type="text"
            aria-label={ariaLabel}
            value={draft}
            maxLength={maxLength}
            disabled={saving}
            onInput={(event) => {
              setDraft((event.target as HTMLInputElement).value);
            }}
            onKeyDown={handleKey}
            onBlur={() => {
              void commit();
            }}
            class={inputClass}
            data-testid={`${testidPrefix}-input`}
          />
        )}
        {error ? (
          <p class="mt-1 text-xs text-rose-600 dark:text-rose-400" role="alert">
            {error}
          </p>
        ) : null}
      </>
    );
  }

  const displayText = value.length > 0 ? value : placeholder;
  return (
    <button
      type="button"
      onClick={() => {
        setEditing(true);
      }}
      title="Click to edit"
      class={displayClass}
      data-testid={testidPrefix}
    >
      {renderDisplay ? renderDisplay(displayText) : displayText}
    </button>
  );
}
