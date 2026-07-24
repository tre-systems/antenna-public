import { useCallback, useEffect, useState } from 'preact/hooks';
import { getAlerts, getNotificationPreferences, updateNotificationPreference } from '../../api';
import type { ActivityState, PreferencePatch } from './types';

export function useSettingsActivity() {
  const [state, setState] = useState<ActivityState>({ kind: 'loading' });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [prefs, alerts] = await Promise.all([
        getNotificationPreferences(),
        getAlerts({ limit: 20 }),
      ]);
      setState({
        kind: 'ready',
        preference: prefs.preferences[0] ?? null,
        alerts: alerts.alerts,
      });
    } catch (err) {
      setState({ kind: 'error', message: activityError(err, 'Failed to load activity.') });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const updatePreference = async (patch: PreferencePatch) => {
    if (state.kind !== 'ready') return;
    setSaving(true);
    setSaveError(null);
    try {
      const { preference } = await updateNotificationPreference('daily_digest', patch);
      setState((current) => (current.kind === 'ready' ? { ...current, preference } : current));
    } catch (err) {
      setSaveError(activityError(err, 'Could not update notifications.'));
    } finally {
      setSaving(false);
    }
  };

  return { saveError, saving, state, updatePreference };
}

const activityError = (err: unknown, fallback: string): string =>
  err instanceof Error ? err.message : fallback;
