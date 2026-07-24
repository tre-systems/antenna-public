import type { SignInError, SocialSignInResponse } from './types';

export const readErrorFromQuery = (): SignInError | null => {
  if (typeof window === 'undefined') return null;
  const raw = new URLSearchParams(window.location.search).get('error');
  if (!raw) return null;
  const kind: SignInError['kind'] = /whitelist|not.*allowed|access_denied/i.test(raw)
    ? 'whitelist'
    : 'generic';
  return { kind, raw };
};

export const startGoogleSignIn = async (): Promise<void> => {
  const res = await fetch('/api/auth/sign-in/social', {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ provider: 'google', callbackURL: '/' }),
  });
  if (!res.ok) throw new Error(`sign-in failed: ${res.status}`);

  const body = (await res.json()) as SocialSignInResponse;
  if (typeof body.url !== 'string' || body.url.length === 0) {
    throw new Error('sign-in response did not include a URL');
  }
  window.location.assign(body.url);
};
