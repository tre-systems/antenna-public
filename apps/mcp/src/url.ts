export function normalizeBaseUrl(url: string): string {
  return url.endsWith('/') ? url : `${url}/`;
}

export function normalizeCookie(value: string): string {
  return value.includes('=') ? value : `better-auth.session_token=${value}`;
}
