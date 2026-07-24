import type { McpOAuthConnectionRecord, McpTokenRecord } from '../../api';

export type TokenListState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly tokens: McpTokenRecord[] }
  | { readonly kind: 'error'; readonly message: string };

export type ConnectionListState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly connections: McpOAuthConnectionRecord[] }
  | { readonly kind: 'error'; readonly message: string };
