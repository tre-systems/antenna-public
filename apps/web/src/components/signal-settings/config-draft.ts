import type { ApiSignal } from '../../api';

export type ConfigDraft = Record<string, string | number>;

// Arrays and objects need dedicated affordances or a future advanced editor.
export function editableConfig(config: ApiSignal['config']): ConfigDraft {
  const draft: ConfigDraft = {};
  for (const [key, value] of Object.entries(config)) {
    if (isEditableValue(value)) draft[key] = value;
  }
  return draft;
}

export function isDraftEqual(a: ConfigDraft, b: ConfigDraft): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

export function updateConfigDraft(
  draft: ConfigDraft,
  key: string,
  original: string | number,
  raw: string,
): ConfigDraft {
  if (typeof original === 'number') {
    return updateNumericDraft(draft, key, raw);
  }
  return { ...draft, [key]: raw };
}

function updateNumericDraft(draft: ConfigDraft, key: string, raw: string): ConfigDraft {
  if (raw.trim() === '') return omitConfigKey(draft, key);
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return { ...draft };
  return { ...draft, [key]: parsed };
}

function omitConfigKey(draft: ConfigDraft, omittedKey: string): ConfigDraft {
  const next: ConfigDraft = {};
  for (const [key, value] of Object.entries(draft)) {
    if (key !== omittedKey) next[key] = value;
  }
  return next;
}

function isEditableValue(value: unknown): value is string | number {
  return typeof value === 'string' || typeof value === 'number';
}

export function configPatchFromDraft(
  originalDraft: ConfigDraft,
  pendingDraft: ConfigDraft,
): Record<string, unknown> {
  const patch: Record<string, unknown> = { ...pendingDraft };
  for (const key of Object.keys(originalDraft)) {
    if (!(key in pendingDraft)) patch[key] = null;
  }
  return patch;
}
