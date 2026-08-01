import { useState } from 'preact/hooks';
import { updateSignal, type ApiSignal } from '../api';
import { signals, loadSignals, settingsSignalId } from '../signals/signals';
import { signalTitle } from '../signal-format';
import { ConfigFieldset } from './signal-settings/ConfigFieldset';
import { SettingsDialog } from './signal-settings/SettingsDialog';
import { RefreshCadenceField } from './signal-settings/RefreshCadenceField';
import { VisibilityFieldset } from './signal-settings/VisibilityFieldset';
import {
  configPatchFromDraft,
  editableConfig,
  isDraftEqual,
  type ConfigDraft,
} from './signal-settings/config-draft';
import { useEscapeDismiss } from './dialog/use-escape-dismiss';

export function SignalSettingsPanel() {
  const signalId = settingsSignalId.value;
  if (!signalId) return null;
  const signal = signals.value?.find((b) => b.id === signalId);
  if (!signal) {
    // Signal disappeared (deleted while panel open) — close cleanly.
    settingsSignalId.value = null;
    return null;
  }

  return (
    <PanelBody
      key={signal.id}
      signalId={signal.id}
      initialRefresh={signal.refresh_seconds}
      initialVisibility={signal.visibility}
      initialConfig={editableConfig(signal.config)}
    />
  );
}

type BodyProps = {
  readonly signalId: string;
  readonly initialRefresh: number;
  readonly initialVisibility: ApiSignal['visibility'];
  readonly initialConfig: ConfigDraft;
};

function PanelBody({ signalId, initialRefresh, initialVisibility, initialConfig }: BodyProps) {
  const [pendingRefresh, setPendingRefresh] = useState(initialRefresh);
  const [pendingVisibility, setPendingVisibility] =
    useState<ApiSignal['visibility']>(initialVisibility);
  const [pendingConfig, setPendingConfig] = useState<ConfigDraft>(initialConfig);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const signal = signals.value?.find((b) => b.id === signalId);

  useEscapeDismiss(!saving, closeSettings);

  if (!signal) return null;

  const refreshDirty = pendingRefresh !== initialRefresh;
  const visibilityDirty = pendingVisibility !== initialVisibility;
  const configDirty = !isDraftEqual(pendingConfig, initialConfig);
  const dirty = refreshDirty || visibilityDirty || configDirty;
  const shareBlocker = signal.source_policy?.public_display_blocker ?? null;
  const configEntries = Object.entries(initialConfig);

  const save = async () => {
    if (saving) return;
    if (!dirty) {
      closeSettings();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateSignal(signalId, {
        ...(refreshDirty ? { refresh_seconds: pendingRefresh } : {}),
        ...(visibilityDirty ? { visibility: pendingVisibility } : {}),
        ...(configDirty ? { config: configPatchFromDraft(initialConfig, pendingConfig) } : {}),
      });
      await loadSignals();
      closeSettings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsDialog
      signalId={signalId}
      title={signalTitle(signal)}
      saving={saving}
      dirty={dirty}
      error={error}
      onClose={closeSettings}
      onSave={save}
    >
      <div class="mt-5 space-y-4">
        <ConfigFieldset
          entries={configEntries}
          draft={pendingConfig}
          disabled={saving}
          onDraftChange={setPendingConfig}
        />
        <RefreshCadenceField
          initialRefresh={initialRefresh}
          pendingRefresh={pendingRefresh}
          disabled={saving}
          onChange={setPendingRefresh}
        />
        <VisibilityFieldset
          signalId={signalId}
          pendingVisibility={pendingVisibility}
          shareBlocker={shareBlocker}
          disabled={saving}
          onChange={setPendingVisibility}
        />
      </div>
    </SettingsDialog>
  );
}

function closeSettings() {
  settingsSignalId.value = null;
}
