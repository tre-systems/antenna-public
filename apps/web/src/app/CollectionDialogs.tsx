import type { User } from '../auth';
import { CreateCollectionDialog } from '../components/CreateCollectionDialog';
import { Slideshow } from '../components/Slideshow';
import { signals as signalsState } from '../signals/signals';

type CollectionDialogsProps = {
  readonly onboardingOpen: boolean;
  readonly slideshowOpen: boolean;
  readonly createCollectionOpen: boolean;
  readonly onMarkOnboardingComplete: () => Promise<User>;
  readonly onCloseSlideshow: () => void;
  readonly onCloseCreateCollection: () => void;
};

export const CollectionDialogs = ({
  onboardingOpen,
  slideshowOpen,
  createCollectionOpen,
  onMarkOnboardingComplete,
  onCloseSlideshow,
  onCloseCreateCollection,
}: CollectionDialogsProps) => (
  <>
    {slideshowOpen ? (
      <Slideshow signals={signalsState.value ?? []} onClose={onCloseSlideshow} />
    ) : null}
    {createCollectionOpen ? (
      <CreateCollectionDialog
        onCreated={
          onboardingOpen
            ? async () => {
                await onMarkOnboardingComplete();
              }
            : undefined
        }
        onClose={onCloseCreateCollection}
      />
    ) : null}
  </>
);
