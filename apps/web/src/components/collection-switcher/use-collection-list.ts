import { useEffect, useState } from 'preact/hooks';
import { listCollections, type CollectionListItem } from '../../api';

type CollectionListState = {
  readonly collections: CollectionListItem[] | null;
  readonly loadError: string | null;
  readonly setCollections: (collections: CollectionListItem[]) => void;
};

export function useCollectionList(open: boolean): CollectionListState {
  const [collections, setCollections] = useState<CollectionListItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || collections !== null) return;
    const flag = { cancelled: false };
    void loadCollections(flag, setCollections, setLoadError);
    return () => {
      flag.cancelled = true;
    };
  }, [open, collections]);

  return { collections, loadError, setCollections };
}

const loadCollections = async (
  flag: { cancelled: boolean },
  setCollections: (collections: CollectionListItem[]) => void,
  setLoadError: (error: string) => void,
): Promise<void> => {
  try {
    const res = await listCollections();
    if (!flag.cancelled) setCollections([...res.collections]);
  } catch (err) {
    if (!flag.cancelled) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load collections.');
    }
  }
};
