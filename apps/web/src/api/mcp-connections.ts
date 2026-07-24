import type { McpOAuthConnectionRecord } from '@antenna/shared';
import { fetchJson } from './http';

export function listMcpConnections(): Promise<McpOAuthConnectionRecord[]> {
  return fetchJson<McpOAuthConnectionRecord[]>('/api/mcp-connections');
}

export function disconnectMcpConnection(
  clientId: string,
): Promise<{ disconnected: true; client_id: string; disconnected_at: number }> {
  return fetchJson(`/api/mcp-connections/${encodeURIComponent(clientId)}`, { method: 'DELETE' });
}
