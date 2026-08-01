import { relativeTime } from '../../relative-time';
import type { TokenListState } from './types';

type Props = {
  readonly revoking: string | null;
  readonly state: TokenListState;
  readonly onRevoke: (id: string) => void;
};

export function TokenList({ state, revoking, onRevoke }: Props) {
  if (state.kind === 'loading') {
    return (
      <p
        class="text-sm italic text-slate-500 dark:text-slate-400"
        data-testid="settings-tokens-loading"
      >
        Loading tokens...
      </p>
    );
  }
  if (state.kind === 'error') return <TokenListError message={state.message} />;
  if (state.tokens.length === 0) return <EmptyTokenList />;
  return (
    <ul class="space-y-2" data-testid="settings-tokens-list">
      {state.tokens.map((token) => (
        <li
          key={token.id}
          class="antenna-panel flex items-center justify-between gap-3 rounded-2xl p-4"
        >
          <div class="min-w-0">
            <p class="truncate text-sm font-medium text-slate-900 dark:text-white">
              {token.label ?? <span class="italic text-slate-400">Unnamed token</span>}
            </p>
            <TokenTimestamps createdAt={token.created_at} lastUsedAt={token.last_used_at} />
          </div>
          <button
            type="button"
            onClick={() => {
              onRevoke(token.id);
            }}
            disabled={revoking !== null}
            class="shrink-0 rounded-md px-3 py-1.5 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-400/40 disabled:opacity-60 dark:text-rose-300 dark:hover:bg-rose-500/10"
            data-testid={`settings-tokens-revoke-${token.id}`}
          >
            {revoking === token.id ? 'Revoking...' : 'Revoke'}
          </button>
        </li>
      ))}
    </ul>
  );
}

function TokenListError({ message }: { readonly message: string }) {
  return (
    <div
      class="antenna-panel rounded-2xl p-6 text-sm ring-1 ring-rose-300/40 dark:ring-rose-400/20"
      data-testid="settings-tokens-error"
    >
      <p class="font-medium text-rose-700 dark:text-rose-300">Couldn't load tokens.</p>
      <p class="mt-1 text-slate-500 dark:text-slate-400">{message}</p>
    </div>
  );
}

function EmptyTokenList() {
  return (
    <div
      class="antenna-panel rounded-2xl p-5 text-sm text-slate-500 dark:text-slate-400"
      data-testid="settings-tokens-empty"
    >
      No legacy manual tokens.
    </div>
  );
}

function TokenTimestamps({
  createdAt,
  lastUsedAt,
}: {
  readonly createdAt: number;
  readonly lastUsedAt: number | null;
}) {
  return (
    <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
      Created {relativeTime(createdAt)}
      <span class="mx-1 text-slate-300 dark:text-slate-600" aria-hidden="true">
        -
      </span>
      {lastUsedAt !== null ? `Last used ${relativeTime(lastUsedAt)}` : 'Never used'}
    </p>
  );
}
