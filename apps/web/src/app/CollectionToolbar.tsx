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
  onCreateCollection,
  onPresent,
  onSaveTitle,
  onSaveVisibility,
  onSignOut,
}: CollectionToolbarProps) {
  return (
    <header class="mb-5 flex min-w-0 items-center justify-between gap-2 border-b border-slate-900/[0.07] pb-3 sm:gap-4 dark:border-white/[0.08]">
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
        <PresentButton onPresent={onPresent} />
        <InstallPrompt />
        <ProfileMenu user={user} signingOut={signingOut} onSignOut={onSignOut} />
      </div>
    </header>
  );
}

const PresentButton = ({ onPresent }: { readonly onPresent: () => void }) => (
  <button
    type="button"
    onClick={onPresent}
    class="antenna-control hidden items-center justify-center gap-0 rounded-lg px-2.5 py-1.5 text-xs font-medium transition sm:inline-flex min-[780px]:gap-1"
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
