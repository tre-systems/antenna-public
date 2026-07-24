import { useCallback, useEffect, useState } from 'preact/hooks';
import { getCurrentUser, signOut, type User } from '../auth';
import { setSignalSnapshotOwner } from '../signals/signals';

export type AuthState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'signed-out' }
  | { readonly kind: 'signed-in'; readonly user: User }
  | { readonly kind: 'error'; readonly message: string };

type SessionFlag = { cancelled: boolean };

export const useAuthSession = (skipSessionProbe: boolean) => {
  const [state, setState] = useState<AuthState>({ kind: 'loading' });
  const [signingOut, setSigningOut] = useState(false);

  useSessionProbe(skipSessionProbe, setState);
  useSignalSnapshotOwner(state);

  const setSignedInUser = useCallback((user: User) => {
    setState({ kind: 'signed-in', user });
  }, []);

  const signOutUser = useCallback(async (): Promise<void> => {
    await runSignOut(setSigningOut, setState);
  }, []);

  return { state, signingOut, setSignedInUser, signOutUser };
};

const useSessionProbe = (skipSessionProbe: boolean, setState: (state: AuthState) => void): void => {
  useEffect(() => {
    if (skipSessionProbe) {
      setState({ kind: 'signed-out' });
      return;
    }
    const flag = { cancelled: false };
    void loadSession(flag, setState);
    return () => {
      flag.cancelled = true;
    };
  }, [skipSessionProbe, setState]);
};

const useSignalSnapshotOwner = (state: AuthState): void => {
  useEffect(() => {
    setSignalSnapshotOwner(state.kind === 'signed-in' ? state.user.id : null);
  }, [state]);
};

const loadSession = async (
  flag: SessionFlag,
  setState: (state: AuthState) => void,
): Promise<void> => {
  try {
    const user = await getCurrentUser();
    if (flag.cancelled) return;
    setState(user ? { kind: 'signed-in', user } : { kind: 'signed-out' });
  } catch (err) {
    if (flag.cancelled) return;
    setState({ kind: 'error', message: errorMessage(err, 'Failed to load session.') });
  }
};

const runSignOut = async (
  setSigningOut: (signingOut: boolean) => void,
  setState: (state: AuthState) => void,
): Promise<void> => {
  setSigningOut(true);
  try {
    await signOut();
    setState({ kind: 'signed-out' });
  } catch (err) {
    setState({ kind: 'error', message: errorMessage(err, 'Failed to sign out.') });
  } finally {
    setSigningOut(false);
  }
};

const errorMessage = (err: unknown, fallback: string): string =>
  err instanceof Error ? err.message : fallback;
