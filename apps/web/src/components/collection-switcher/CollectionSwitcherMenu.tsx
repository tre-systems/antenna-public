import type { CollectionListItem } from '../../api';
import type { CollectionSwitcherMenuProps } from './types';
import { collectionUrl } from './url';

export function CollectionSwitcherMenu({
  activeId,
  collections,
  loadError,
  onCreateClick,
  onDeleteClick,
}: CollectionSwitcherMenuProps) {
  return (
    <div
      role="menu"
      class="absolute right-0 top-9 z-20 min-w-[14rem] overflow-hidden rounded-md bg-white shadow-lg ring-1 ring-slate-900/10 dark:bg-slate-900 dark:ring-white/10"
      data-testid="collection-switcher-menu"
    >
      <CollectionList
        activeId={activeId}
        collections={collections}
        loadError={loadError}
        onDeleteClick={onDeleteClick}
      />
      <div class="border-t border-slate-200 dark:border-white/10">
        <button
          type="button"
          role="menuitem"
          onClick={onCreateClick}
          class="block w-full px-3 py-2 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-900/[0.04] dark:text-slate-200 dark:hover:bg-white/5"
          data-testid="collection-switcher-create"
        >
          + New collection
        </button>
      </div>
    </div>
  );
}

function CollectionList({
  activeId,
  collections,
  loadError,
  onDeleteClick,
}: Omit<CollectionSwitcherMenuProps, 'onCreateClick'>) {
  if (loadError) {
    return <p class="px-3 py-2 text-xs text-rose-600 dark:text-rose-400">{loadError}</p>;
  }
  if (collections === null) {
    return <p class="px-3 py-2 text-xs italic text-slate-500 dark:text-slate-400">Loading…</p>;
  }
  return (
    <ul class="max-h-72 overflow-y-auto py-1">
      {collections.map((collection) => (
        <CollectionRow
          key={collection.id}
          activeId={activeId}
          collection={collection}
          collections={collections}
          onDeleteClick={onDeleteClick}
        />
      ))}
    </ul>
  );
}

function CollectionRow({
  activeId,
  collection,
  collections,
  onDeleteClick,
}: {
  readonly activeId: string | null;
  readonly collection: CollectionListItem;
  readonly collections: readonly CollectionListItem[];
  readonly onDeleteClick: (collection: CollectionListItem) => void;
}) {
  const isActive =
    activeId === collection.id || (activeId === null && collection.id === collections[0]?.id);
  const canDelete = collections.length > 1;
  return (
    <li>
      <div
        class={`flex items-center justify-between gap-3 px-3 py-2 text-sm transition-colors ${
          isActive
            ? 'bg-slate-100 text-slate-900 dark:bg-white/[0.08] dark:text-white'
            : 'text-slate-700 hover:bg-slate-900/[0.04] dark:text-slate-200 dark:hover:bg-white/5'
        }`}
      >
        <a
          href={collectionUrl(collection.id)}
          role="menuitem"
          class="min-w-0 flex-1 truncate focus:outline-none focus:ring-2 focus:ring-sky-400/40"
          data-testid={`collection-switcher-item-${collection.id}`}
        >
          {collection.title}
        </a>
        <span class="shrink-0 text-xs text-slate-400 tabular-nums dark:text-slate-500">
          {collection.signal_count}
        </span>
        <DeleteButton collection={collection} canDelete={canDelete} onDeleteClick={onDeleteClick} />
      </div>
    </li>
  );
}

function DeleteButton({
  collection,
  canDelete,
  onDeleteClick,
}: {
  readonly collection: CollectionListItem;
  readonly canDelete: boolean;
  readonly onDeleteClick: (collection: CollectionListItem) => void;
}) {
  return (
    <button
      type="button"
      aria-label={`Delete ${collection.title}`}
      title={canDelete ? `Delete ${collection.title}` : "You can't delete your final collection"}
      disabled={!canDelete}
      onClick={() => {
        onDeleteClick(collection);
      }}
      class="shrink-0 rounded p-1 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 focus:outline-none focus:ring-2 focus:ring-sky-400/40 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400 dark:hover:bg-rose-500/10 dark:hover:text-rose-300"
      data-testid={`collection-switcher-delete-${collection.id}`}
    >
      <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" class="h-3.5 w-3.5">
        <path d="M6.5 2a1 1 0 0 0-1 1v.5H3.25a.75.75 0 0 0 0 1.5h.3l.55 7.1A2 2 0 0 0 6.1 14h3.8a2 2 0 0 0 2-1.9l.55-7.1h.3a.75.75 0 0 0 0-1.5H10.5V3a1 1 0 0 0-1-1h-3Zm.5 1.5h2v.0H7v.0Zm-1.95 1.5h5.9l-.53 6.98a.5.5 0 0 1-.5.47H6.08a.5.5 0 0 1-.5-.47L5.05 5Zm1.7 1.35a.65.65 0 0 1 .65.65v4a.65.65 0 1 1-1.3 0v-4a.65.65 0 0 1 .65-.65Zm2.5 0a.65.65 0 0 1 .65.65v4a.65.65 0 1 1-1.3 0v-4a.65.65 0 0 1 .65-.65Z" />
      </svg>
    </button>
  );
}
