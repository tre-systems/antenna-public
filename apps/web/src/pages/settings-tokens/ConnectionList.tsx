import { relativeTime } from '../../relativeTime';
import type { ConnectionListState } from './types';

type Props = {
  readonly disconnecting: string | null;
  readonly state: ConnectionListState;
  readonly onDisconnect: (clientId: string) => void;
};

export function ConnectionList({ state, disconnecting, onDisconnect }: Props) {
  if (state.kind === 'loading') {
    return (
      <p
        class="text-sm italic text-slate-500 dark:text-slate-400"
        data-testid="settings-connections-loading"
      >
        Loading connections...
      </p>
    );
  }
  if (state.kind === 'error') {
    return (
      <div
        class="rounded-2xl bg-white/70 p-6 text-sm ring-1 ring-rose-300/40 dark:bg-white/[0.04]"
        role="alert"
      >
        <p class="font-medium text-rose-700 dark:text-rose-300">Couldn't load connections.</p>
        <p class="mt-1 text-slate-500 dark:text-slate-400">{state.message}</p>
      </div>
    );
  }
  if (state.connections.length === 0) {
    return (
      <div class="rounded-2xl bg-white/70 p-5 text-sm text-slate-500 ring-1 ring-slate-900/5 dark:bg-white/[0.04] dark:text-slate-400 dark:ring-white/10">
        No agents are connected with OAuth.
      </div>
    );
  }
  return (
    <ul class="space-y-2" data-testid="settings-connections-list">
      {state.connections.map((connection) => (
        <li
          key={connection.client_id}
          class="flex items-center justify-between gap-3 rounded-2xl bg-white/70 p-4 ring-1 ring-slate-900/5 dark:bg-white/[0.04] dark:ring-white/10"
        >
          <div class="min-w-0">
            <p class="truncate text-sm font-medium text-slate-900 dark:text-white">
              {connection.name}
            </p>
            <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Connected {relativeTime(connection.created_at)} · Last refreshed{' '}
              {relativeTime(connection.last_refreshed_at)} · Grant expires{' '}
              {relativeTime(connection.refresh_expires_at)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              onDisconnect(connection.client_id);
            }}
            disabled={disconnecting === connection.client_id}
            class="shrink-0 rounded-md px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-400/40 disabled:opacity-60 dark:text-rose-300 dark:hover:bg-rose-500/10"
            data-testid={`settings-connections-disconnect-${connection.client_id}`}
          >
            {disconnecting === connection.client_id ? 'Disconnecting...' : 'Disconnect'}
          </button>
        </li>
      ))}
    </ul>
  );
}
