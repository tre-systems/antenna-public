import type { SignalAlertRecord, CollectionRecord } from '../../api';
import { relativeTime } from '../../relativeTime';
import { safeExternalUrl } from '../../signal-format/display';
import { formatAlertValue } from './format';

type Props = {
  readonly alerts: ReadonlyArray<SignalAlertRecord>;
  readonly collection: CollectionRecord | null;
};

export function RecentAlerts({ alerts, collection }: Props) {
  return (
    <section data-testid="activity-alerts">
      <div class="mb-3 flex items-baseline justify-between gap-3">
        <h2 class="text-sm font-semibold text-slate-900 dark:text-white">Recent alerts</h2>
        {collection ? (
          <span class="text-xs text-slate-400 dark:text-slate-500">{collection.title}</span>
        ) : null}
      </div>
      {alerts.length === 0 ? <EmptyAlerts /> : <AlertList alerts={alerts} />}
    </section>
  );
}

function EmptyAlerts() {
  return (
    <div class="rounded-2xl bg-white/70 p-5 text-sm text-slate-500 ring-1 ring-slate-900/5 backdrop-blur-xl dark:bg-white/[0.04] dark:text-slate-400 dark:ring-white/10">
      No alerts yet. Alert rules will appear here once a watched value crosses a threshold.
    </div>
  );
}

function AlertList({ alerts }: { readonly alerts: ReadonlyArray<SignalAlertRecord> }) {
  return (
    <ul class="space-y-2">
      {alerts.map((alert) => (
        <li
          key={alert.id}
          class="rounded-2xl bg-white/70 p-4 ring-1 ring-slate-900/5 backdrop-blur-xl dark:bg-white/[0.04] dark:ring-white/10"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="truncate text-sm font-medium text-slate-900 dark:text-white">
                {alert.title}
              </p>
              <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {alert.rule_label} · {formatAlertValue(alert)}
              </p>
            </div>
            <span class="shrink-0 text-xs text-slate-400 dark:text-slate-500">
              {relativeTime(alert.triggered_at)}
            </span>
          </div>
          {safeExternalUrl(alert.source_url) ? (
            <a
              href={safeExternalUrl(alert.source_url) ?? undefined}
              target="_blank"
              rel="noreferrer"
              class="mt-2 inline-flex text-xs font-medium text-sky-700 hover:underline focus:outline-none focus:ring-2 focus:ring-sky-400/40 dark:text-sky-300"
            >
              Source
            </a>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
