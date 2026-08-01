import { useCallback, useEffect, useState } from 'preact/hooks';
import { disconnectMcpConnection, listMcpConnections } from '../../api';
import type { ConnectionListState } from './types';

export function useMcpConnections() {
  const [list, setList] = useState<ConnectionListState>({ kind: 'loading' });
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const connections = await listMcpConnections();
      setList({ kind: 'ready', connections });
    } catch (err) {
      setList({ kind: 'error', message: connectionError(err, 'Failed to load connections.') });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const disconnect = async (clientId: string) => {
    if (disconnecting !== null) return;
    setDisconnecting(clientId);
    try {
      await disconnectMcpConnection(clientId);
      await refresh();
    } catch (err) {
      setList({ kind: 'error', message: connectionError(err, 'Could not disconnect agent.') });
    } finally {
      setDisconnecting(null);
    }
  };

  return { list, disconnecting, disconnect };
}

const connectionError = (err: unknown, fallback: string): string =>
  err instanceof Error ? err.message : fallback;
