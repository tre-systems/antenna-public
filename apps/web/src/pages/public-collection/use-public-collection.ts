import { useEffect, useState } from 'preact/hooks';
import { getPublicCollection, getSharedCollection } from '../../api';
import type { PublicCollectionLoadState, ShareableCollectionResponse } from './types';

export function usePublicCollection(slug: string) {
  const [state, setState] = useState<PublicCollectionLoadState>({ kind: 'loading' });

  useEffect(() => {
    const flag = { cancelled: false };
    setState({ kind: 'loading' });
    void loadShareableCollection(slug, flag, setState);
    return () => {
      flag.cancelled = true;
    };
  }, [slug]);

  return { state };
}

async function loadShareableCollection(
  slug: string,
  flag: { cancelled: boolean },
  setState: (state: PublicCollectionLoadState) => void,
): Promise<void> {
  try {
    const data = await fetchShareableCollection(slug);
    if (!flag.cancelled) setState({ kind: 'ready', data });
  } catch (err) {
    if (flag.cancelled) return;
    const message = err instanceof Error ? err.message : 'Failed to load.';
    setState({ kind: /404/.test(message) ? 'not-found' : 'error', message });
  }
}

async function fetchShareableCollection(slug: string): Promise<ShareableCollectionResponse> {
  try {
    return await getSharedCollection(slug);
  } catch (err) {
    if (!isNotFound(err)) throw err;
    return getPublicCollection(slug);
  }
}

const isNotFound = (err: unknown): boolean => err instanceof Error && /404/.test(err.message);
