import type { CollectionTemplateRecord } from '../../api';

export type TemplateState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly templates: ReadonlyArray<CollectionTemplateRecord> }
  | { readonly kind: 'error'; readonly message: string };
