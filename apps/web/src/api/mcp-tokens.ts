import type { McpTokenRecord } from '@antenna/shared';

import { fetchJson } from './http';

export function listMcpTokens(): Promise<McpTokenRecord[]> {
  return fetchJson<McpTokenRecord[]>('/api/mcp-tokens');
}

export function revokeMcpToken(
  id: string,
): Promise<{ revoked: true; id: string; revoked_at: number }> {
  return fetchJson(`/api/mcp-tokens/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
