export function requireBaseUrl(value: string | undefined): string {
  if (value === undefined || value.trim().length === 0) {
    throw new Error(
      'Set ANTENNA_BASE_URL to the origin of your Antenna Worker, for example http://localhost:8787.',
    );
  }
  return normalizeBaseUrl(value.trim());
}

export function normalizeBaseUrl(url: string): string {
  return url.endsWith('/') ? url : `${url}/`;
}

export function normalizeCookie(value: string): string {
  return value.includes('=') ? value : `better-auth.session_token=${value}`;
}
