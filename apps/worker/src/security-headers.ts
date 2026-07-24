import type { MiddlewareHandler } from 'hono';

const THEME_SCRIPT_HASH = "'sha256-s1YGqkXITgNMbsthUh0teYtdHJ6aWVw/xHfGxU9NNRM='";

export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'none'",
  `script-src 'self' ${THEME_SCRIPT_HASH}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://lh3.googleusercontent.com",
  "font-src 'self' data:",
  "connect-src 'self' https://*.ingest.de.sentry.io",
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  'upgrade-insecure-requests',
].join('; ');

const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'Content-Security-Policy': CONTENT_SECURITY_POLICY,
  'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), geolocation=(), microphone=(), payment=(), usb=()',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
};

export const securityHeaders = (): MiddlewareHandler => async (c, next) => {
  await next();
  const headers = new Headers(c.res.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
  if (c.req.path.startsWith('/api/')) {
    headers.set('Cache-Control', 'no-store');
    headers.set('Pragma', 'no-cache');
  }
  c.res = new Response(c.res.body, {
    status: c.res.status,
    statusText: c.res.statusText,
    headers,
  });
};
