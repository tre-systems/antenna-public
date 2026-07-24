import { useCallback, useEffect, useState } from 'preact/hooks';
import type { CollectionRecord } from '@antenna/shared';
import { getCollection, getCollectionById, updateCollection } from '../api';
import { activeCollectionId } from '../signals/signals';

export const useSelectedCollectionSignal = (selectedCollectionId: string | null): void => {
  useEffect(() => {
    activeCollectionId.value = selectedCollectionId;
    return () => {
      activeCollectionId.value = null;
    };
  }, [selectedCollectionId]);
};

export const useCollectionState = (signedIn: boolean, selectedCollectionId: string | null) => {
  const [collection, setCollection] = useState<CollectionRecord | null>(null);

  useEffect(() => {
    if (!signedIn) return;
    const flag = { cancelled: false };
    void loadCollection(selectedCollectionId, flag, setCollection);
    return () => {
      flag.cancelled = true;
    };
  }, [signedIn, selectedCollectionId]);

  const saveTitle = useCallback(
    async (next: string) => {
      setCollection(await updateCollection({ title: next }, selectedCollectionId ?? undefined));
    },
    [selectedCollectionId],
  );

  const saveDescription = useCallback(
    async (next: string) => {
      const description = next.length > 0 ? next : null;
      setCollection(await updateCollection({ description }, selectedCollectionId ?? undefined));
    },
    [selectedCollectionId],
  );

  const saveVisibility = useCallback(
    async (visibility: CollectionRecord['visibility']) => {
      setCollection(await updateCollection({ visibility }, selectedCollectionId ?? undefined));
    },
    [selectedCollectionId],
  );

  return { collection, saveTitle, saveDescription, saveVisibility };
};

type LoadFlag = { cancelled: boolean };

const loadCollection = async (
  selectedCollectionId: string | null,
  flag: LoadFlag,
  setCollection: (collection: CollectionRecord) => void,
): Promise<void> => {
  try {
    const record = await fetchCollection(selectedCollectionId);
    if (!flag.cancelled) setCollection(record);
  } catch {
    // Header falls back to defaults if the fetch fails.
  }
};

const fetchCollection = async (selectedCollectionId: string | null): Promise<CollectionRecord> =>
  selectedCollectionId === null
    ? await getCollection()
    : (await getCollectionById(selectedCollectionId)).collection;
