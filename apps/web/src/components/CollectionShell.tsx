import { useEffect } from 'preact/hooks';
import {
  isOffline,
  loadSignals,
  loadSignalsById,
  setSignalSnapshotOwner,
  showNotice,
  signals,
} from '../signals/signals';
import { SignalSettingsPanel } from './SignalSettingsPanel';
import { OfflineBanner } from './OfflineBanner';
import { NoticeToast } from './NoticeToast';
import { UndoToast } from './UndoToast';
import { connectCollectionStream } from './collection-stream';
import { SignalGrid } from './collection-shell/SignalGrid';
import { SignalComposer } from './SignalComposer';

type Props = {
  readonly collectionId: string | null;
  readonly composerOpen: boolean;
  readonly ownerId: string;
  readonly onComposerOpenChange: (open: boolean) => void;
  readonly focusAsk?: boolean;
};

function handleConfirmed(createdSignalIds: readonly string[]): void {
  // Capture emptiness before loading so the first-signal confirmation remains distinct.
  const wasFirst = (signals.value?.length ?? 0) === 0;
  void loadSignalsById(createdSignalIds);
  const count = createdSignalIds.length;
  if (count === 0) return;
  const lead =
    wasFirst && count === 1
      ? 'Your first signal is live'
      : count === 1
        ? 'Signal created'
        : `${String(count)} signals created`;
  showNotice(`${lead} — fetching data now.`);
}

export function CollectionShell({
  collectionId,
  composerOpen,
  ownerId,
  onComposerOpenChange,
  focusAsk = false,
}: Props) {
  useCollectionSignals(collectionId, ownerId);

  return (
    <div class="space-y-4">
      <OfflineBanner />
      <SignalComposer
        open={composerOpen}
        onConfirmed={handleConfirmed}
        onOpenChange={onComposerOpenChange}
        offline={isOffline.value}
        autoFocus={focusAsk}
      />
      <SignalGrid />
      <UndoToast />
      <NoticeToast />
      <SignalSettingsPanel />
    </div>
  );
}

function useCollectionSignals(collectionId: string | null, ownerId: string): void {
  useEffect(() => {
    setSignalSnapshotOwner(ownerId);
    void loadSignals(collectionId, ownerId);
    const streamUrl =
      collectionId === null ? null : `/api/collections/${encodeURIComponent(collectionId)}/stream`;
    const connection = streamUrl
      ? connectCollectionStream(streamUrl, {
          onEvent: () => {
            void loadSignals(collectionId, ownerId);
          },
        })
      : null;
    window.addEventListener('online', reload);
    window.addEventListener('offline', markOffline);
    return () => {
      connection?.close();
      window.removeEventListener('online', reload);
      window.removeEventListener('offline', markOffline);
    };

    function reload() {
      void loadSignals(collectionId, ownerId);
    }
  }, [collectionId, ownerId]);
}

function markOffline(): void {
  isOffline.value = true;
}
