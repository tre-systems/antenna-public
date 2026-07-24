import type { CollectionRecord } from '@antenna/shared';
import type { User } from '../auth';
import { PRODUCT_NAME } from '../brand';
import { CollectionHeader } from '../components/CollectionHeader';
import { CollectionSwitcher } from '../components/CollectionSwitcher';
import { InstallPrompt } from '../components/InstallPrompt';
import { ProfileMenu } from '../components/ProfileMenu';
import { ShareMenu } from '../components/ShareMenu';

type CollectionToolbarProps = {
  readonly user: User;
  readonly collection: CollectionRecord | null;
  readonly selectedCollectionId: string | null;
  readonly signingOut: boolean;
  readonly onAddSignal: () => void;
  readonly onCreateCollection: () => void;
  readonly onPresent: () => void;
  readonly onSaveTitle: (next: string) => Promise<void>;
  readonly onSaveVisibility: (next: CollectionRecord['visibility']) => Promise<void>;
  readonly onSignOut: () => void;
};

export function CollectionToolbar({
  user,
  collection,
  selectedCollectionId,
  signingOut,
  onAddSignal,
  onCreateCollection,
  onPresent,
  onSaveTitle,
  onSaveVisibility,
  onSignOut,
}: CollectionToolbarProps) {
  return (
    <header class="mb-4 flex min-w-0 items-center justify-between gap-2 sm:gap-4">
      <CollectionHeader title={collection?.title ?? PRODUCT_NAME} onSaveTitle={onSaveTitle} />
      <div class="flex shrink-0 items-center justify-end gap-1.5 sm:gap-2">
        <CollectionSwitcher
          activeId={selectedCollectionId}
          primaryTitle={collection?.title ?? PRODUCT_NAME}
          onCreateClick={onCreateCollection}
        />
        {collection ? (
          <ShareMenu
            visibility={collection.visibility}
            slug={collection.slug}
            onChange={onSaveVisibility}
          />
        ) : null}
        <AddSignalButton onAddSignal={onAddSignal} />
        <PresentButton onPresent={onPresent} />
        <InstallPrompt />
        <ProfileMenu user={user} signingOut={signingOut} onSignOut={onSignOut} />
      </div>
    </header>
  );
}

const AddSignalButton = ({ onAddSignal }: { readonly onAddSignal: () => void }) => (
  <button
    type="button"
    onClick={onAddSignal}
    class="inline-flex items-center justify-center gap-0 rounded-lg bg-gradient-to-br from-teal-500 to-sky-600 px-2.5 py-1.5 text-xs font-medium text-white shadow-[0_4px_18px_-8px_rgba(14,165,233,0.8)] transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-teal-500/40 min-[780px]:gap-1.5"
    data-testid="signal-composer-open"
    aria-label="Add signal"
    title="Add a signal"
  >
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" class="h-3.5 w-3.5">
      <path d="M8 1.5l1.4 3.7L13 6.5l-3.6 1.3L8 11.5 6.6 7.8 3 6.5l3.6-1.3L8 1.5zM12.5 10l.7 1.8L15 12.5l-1.8.7-.7 1.8-.7-1.8L10 12.5l1.8-.7.7-1.8z" />
    </svg>
    <span class="hidden min-[780px]:inline">Add signal</span>
  </button>
);

const PresentButton = ({ onPresent }: { readonly onPresent: () => void }) => (
  <button
    type="button"
    onClick={onPresent}
    class="hidden items-center justify-center gap-0 rounded-lg bg-white/50 px-2.5 py-1.5 text-xs font-medium text-slate-600 ring-1 ring-slate-900/10 transition hover:bg-white/80 hover:text-slate-900 sm:inline-flex min-[780px]:gap-1 dark:bg-white/5 dark:text-slate-200 dark:ring-white/10 dark:hover:bg-white/10 dark:hover:text-white"
    data-testid="header-present"
    aria-label="Present collection"
    title="Present this collection as a fullscreen slideshow"
  >
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" class="h-3.5 w-3.5">
      <path d="M2.5 3a1.5 1.5 0 0 0-1.5 1.5v6A1.5 1.5 0 0 0 2.5 12h11A1.5 1.5 0 0 0 15 10.5v-6A1.5 1.5 0 0 0 13.5 3h-11Zm4.5 2.5L11 7.5 7 9.5v-4Z" />
      <path d="M5.5 14h5v-1h-5v1Z" />
    </svg>
    <span class="hidden min-[780px]:inline">Present</span>
  </button>
);
