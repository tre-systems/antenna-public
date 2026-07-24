import { useState } from 'preact/hooks';
import type { CollectionRecord } from '@antenna/shared';
import type { User } from '../auth';
import { CollectionShell } from '../components/CollectionShell';
import { OnboardingShell } from '../components/OnboardingShell';
import { CollectionDialogs } from './CollectionDialogs';
import { CollectionToolbar } from './CollectionToolbar';

type OnboardingControls = {
  readonly saving: boolean;
  readonly error: string | null;
  readonly focusAsk: boolean;
  readonly complete: () => Promise<void>;
  readonly completeThenFocusAsk: () => Promise<void>;
  readonly markComplete: () => Promise<User>;
};

type CollectionExperienceProps = {
  readonly user: User;
  readonly collection: CollectionRecord | null;
  readonly selectedCollectionId: string | null;
  readonly signingOut: boolean;
  readonly onboarding: OnboardingControls;
  readonly onSaveTitle: (next: string) => Promise<void>;
  readonly onSaveVisibility: (next: CollectionRecord['visibility']) => Promise<void>;
  readonly onSignOut: () => Promise<void>;
};

export function CollectionExperience({
  user,
  collection,
  selectedCollectionId,
  signingOut,
  onboarding,
  onSaveTitle,
  onSaveVisibility,
  onSignOut,
}: CollectionExperienceProps) {
  const [slideshowOpen, setSlideshowOpen] = useState(false);
  const [signalComposerOpen, setSignalComposerOpen] = useState(false);
  const [createCollectionOpen, setCreateCollectionOpen] = useState(false);
  const onboardingOpen = user.onboarded_at === null;

  return (
    <main
      data-testid="collection-experience"
      class="mx-auto min-h-dvh max-w-7xl px-3 pb-6 pt-[calc(env(safe-area-inset-top)+0.75rem)] sm:px-5 lg:px-6"
    >
      <CollectionToolbar
        user={user}
        collection={collection}
        selectedCollectionId={selectedCollectionId}
        signingOut={signingOut}
        onAddSignal={() => {
          setSignalComposerOpen(true);
        }}
        onCreateCollection={() => {
          setCreateCollectionOpen(true);
        }}
        onPresent={() => {
          setSlideshowOpen(true);
        }}
        onSaveTitle={onSaveTitle}
        onSaveVisibility={onSaveVisibility}
        onSignOut={() => {
          void onSignOut();
        }}
      />
      <OnboardingPanel
        user={user}
        open={onboardingOpen}
        onboarding={onboarding}
        onCreateCollection={() => {
          setCreateCollectionOpen(true);
        }}
      />
      {onboardingOpen ? null : (
        <CollectionShell
          collectionId={collection?.id ?? selectedCollectionId}
          composerOpen={signalComposerOpen}
          ownerId={user.id}
          onComposerOpenChange={setSignalComposerOpen}
          focusAsk={onboarding.focusAsk}
        />
      )}
      <CollectionDialogs
        onboardingOpen={onboardingOpen}
        slideshowOpen={slideshowOpen}
        createCollectionOpen={createCollectionOpen}
        onMarkOnboardingComplete={onboarding.markComplete}
        onCloseSlideshow={() => {
          setSlideshowOpen(false);
        }}
        onCloseCreateCollection={() => {
          setCreateCollectionOpen(false);
        }}
      />
    </main>
  );
}

const OnboardingPanel = ({
  user,
  open,
  onboarding,
  onCreateCollection,
}: {
  readonly user: User;
  readonly open: boolean;
  readonly onboarding: OnboardingControls;
  readonly onCreateCollection: () => void;
}) =>
  open ? (
    <OnboardingShell
      user={user}
      saving={onboarding.saving}
      error={onboarding.error}
      onUseStarter={() => {
        void onboarding.complete();
      }}
      onCreateCollection={onCreateCollection}
      onAddSignal={() => {
        void onboarding.completeThenFocusAsk();
      }}
    />
  ) : null;
