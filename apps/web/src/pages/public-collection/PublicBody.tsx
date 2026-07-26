import { SignalCard } from '../../components/SignalCard';
import type { PublicCollectionLoadState } from './types';

type Props = {
  readonly slug: string;
  readonly state: PublicCollectionLoadState;
};

export function PublicBody({ slug, state }: Props) {
  if (state.kind === 'loading') {
    return (
      <p class="text-sm italic text-slate-500 dark:text-slate-400" data-testid="public-loading">
        Loading...
      </p>
    );
  }
  if (state.kind === 'not-found') return <NotFound slug={slug} />;
  if (state.kind === 'error') return <PublicError message={state.message} />;
  if (state.data.signals.length === 0) return <EmptyPublicCollection />;
  return <PublicGrid state={state} />;
}

function NotFound({ slug }: { readonly slug: string }) {
  return (
    <div class="antenna-panel rounded-2xl p-6 text-sm" data-testid="public-not-found">
      <p class="font-medium text-slate-900 dark:text-white">No shared collection here.</p>
      <p class="mt-1 text-slate-500 dark:text-slate-400">
        The link <span class="font-mono">/c/{slug}</span> is not available. It may have been set
        back to private, or the slug is wrong.
      </p>
    </div>
  );
}

function PublicError({ message }: { readonly message: string }) {
  return (
    <div
      class="antenna-panel rounded-2xl p-6 text-sm ring-1 ring-rose-300/40 dark:ring-rose-400/20"
      data-testid="public-error"
    >
      <p class="font-medium text-rose-700 dark:text-rose-300">Couldn't load this collection.</p>
      <p class="mt-1 text-slate-500 dark:text-slate-400">{message}</p>
    </div>
  );
}

function EmptyPublicCollection() {
  return (
    <div
      class="antenna-panel rounded-2xl p-6 text-sm text-slate-500 dark:text-slate-400"
      data-testid="public-empty"
    >
      This collection does not have any shareable signals right now.
    </div>
  );
}

function PublicGrid({
  state,
}: {
  readonly state: Extract<PublicCollectionLoadState, { kind: 'ready' }>;
}) {
  const { collection, signals } = state.data;
  return (
    <div class="space-y-6" data-testid="public-grid">
      {collection.description ? (
        <p class="text-sm text-slate-600 dark:text-slate-300">{collection.description}</p>
      ) : null}
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {signals.map((signal) => (
          <SignalCard key={signal.id} signal={signal} readOnly />
        ))}
      </div>
    </div>
  );
}
