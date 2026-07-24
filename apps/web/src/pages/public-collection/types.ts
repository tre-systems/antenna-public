import type { PublicCollectionResponse, SharedCollectionResponse } from '../../api';

export type ShareableCollectionResponse = PublicCollectionResponse | SharedCollectionResponse;

export type PublicCollectionLoadState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly data: ShareableCollectionResponse }
  | { readonly kind: 'not-found' }
  | { readonly kind: 'error'; readonly message: string };
