import { oauthOrigin } from './oauth-provider';

// Non-browser clients may omit Origin; browsers must not delegate ambient cookies cross-origin.
export const cookieWriteAllowed = (request: Request, baseUrl?: string): boolean => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return true;
  const origin = request.headers.get('origin');
  const expected = oauthOrigin(baseUrl);
  if (origin !== null) {
    if (origin === expected) return true;
    const local = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(expected);
    return local && ['http://localhost:5173', 'http://localhost:8787'].includes(origin);
  }
  const site = request.headers.get('sec-fetch-site');
  return site === null || site === 'same-origin';
};
