import { useCallback, useEffect, useState } from 'preact/hooks';
import { listMcpTokens, revokeMcpToken } from '../../api';
import type { TokenListState } from './types';

export function useMcpTokens() {
  const [list, setList] = useState<TokenListState>({ kind: 'loading' });
  const [revoking, setRevoking] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const tokens = await listMcpTokens();
      setList({ kind: 'ready', tokens });
    } catch (err) {
      setList({ kind: 'error', message: tokenError(err, 'Failed to load tokens.') });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const revokeToken = async (id: string) => {
    setRevoking(id);
    try {
      await revokeMcpToken(id);
      await refresh();
    } catch (err) {
      setList({ kind: 'error', message: tokenError(err, 'Could not revoke token.') });
    } finally {
      setRevoking(null);
    }
  };

  return {
    list,
    revoking,
    revokeToken,
  };
}

const tokenError = (err: unknown, fallback: string): string =>
  err instanceof Error ? err.message : fallback;
