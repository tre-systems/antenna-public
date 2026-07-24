import type { CollectionRecord } from '../api';
import { ConnectorRequests } from '../components/ConnectorRequests';
import { SettingsShell } from '../components/SettingsShell';
import { AgentAccessPanel } from './settings-activity/AgentAccessPanel';
import { NotificationPreferencePanel } from './settings-activity/NotificationPreferencePanel';
import { RecentAlerts } from './settings-activity/RecentAlerts';
import { useSettingsActivity } from './settings-activity/use-settings-activity';

export { formatAlertValue } from './settings-activity/format';
export { NotificationPreferencePanel } from './settings-activity/NotificationPreferencePanel';

export function SettingsActivity({ collection }: { readonly collection: CollectionRecord | null }) {
  const activity = useSettingsActivity();

  return (
    <SettingsShell
      title="Activity"
      description="Recent collection alerts, the daily brief preference, and maintenance diagnostics."
    >
      {activity.state.kind === 'loading' ? (
        <p class="text-sm italic text-slate-500 dark:text-slate-400" data-testid="activity-loading">
          Loading activity...
        </p>
      ) : null}

      {activity.state.kind === 'error' ? (
        <div
          class="antenna-panel rounded-2xl p-6 text-sm ring-1 ring-rose-300/40 dark:ring-rose-400/20"
          data-testid="activity-error"
        >
          <p class="font-medium text-rose-700 dark:text-rose-300">Couldn't load activity.</p>
          <p class="mt-1 text-slate-500 dark:text-slate-400">{activity.state.message}</p>
        </div>
      ) : null}

      {activity.state.kind === 'ready' ? (
        <div class="space-y-6">
          <NotificationPreferencePanel
            preference={activity.state.preference}
            saving={activity.saving}
            error={activity.saveError}
            onChange={activity.updatePreference}
          />
          <RecentAlerts alerts={activity.state.alerts} collection={collection} />
          <AgentAccessPanel />
          <ConnectorRequests />
        </div>
      ) : null}
    </SettingsShell>
  );
}
