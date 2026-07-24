import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { sourcePolicyForTemplate } from '@antenna/registry';
import { PRODUCT_NAME } from '../brand';
import { db, type Env as DbEnv } from '../db/client';
import { collections, signals } from '../db/schema';
import { canReadSignalWithSourcePolicy } from '../policy/source-access';

type Bindings = DbEnv & {
  readonly ASSETS: AssetFetcher;
  readonly BETTER_AUTH_URL?: string;
};

type SignalRow = typeof signals.$inferSelect;
type AssetFetcher = {
  fetch(request: Request): Promise<Response>;
};

export const publicCollectionPageRoute = new Hono<{ Bindings: Bindings }>().get(
  '/:slug',
  async (c) => {
    const slug = c.req.param('slug');
    const client = db(c.env);
    const [collection] = await client
      .select()
      .from(collections)
      .where(and(eq(collections.slug, slug), eq(collections.visibility, 'public')))
      .limit(1)
      .all();

    const index = await fetchIndexHtml(c.env.ASSETS, c.req.raw);
    if (!collection) return index;

    const signalRows = await client
      .select()
      .from(signals)
      .where(eq(signals.collectionId, collection.id))
      .all();
    const publicSignalCount = signalRows.filter(isPublicReadableSignal).length;
    const baseUrl = c.env.BETTER_AUTH_URL ?? new URL(c.req.url).origin;
    const shareUrl = new URL(`/c/${encodeURIComponent(slug)}`, baseUrl).toString();
    const description =
      collection.description?.trim() ||
      `${collection.title} is a live public collection on ${PRODUCT_NAME}.`;

    return htmlResponseWithMeta(index, {
      title: `${collection.title} | ${PRODUCT_NAME}`,
      description: `${description} ${publicSignalCountDescription(publicSignalCount)}`.trim(),
      url: shareUrl,
    });
  },
);

const fetchIndexHtml = (assets: AssetFetcher, request: Request): Promise<Response> => {
  const url = new URL('/index.html', request.url);
  return assets.fetch(new Request(url.toString(), { headers: request.headers }));
};

const isPublicReadableSignal = (signal: SignalRow): boolean =>
  canReadSignalWithSourcePolicy({
    collectionVisibility: 'public',
    signalVisibility: signal.visibility,
    policy: sourcePolicyForTemplate(signal.templateId),
    audience: 'public',
  }).ok;

const publicSignalCountDescription = (count: number): string => {
  if (count === 0) return 'No shareable signals are currently visible.';
  if (count === 1) return 'Includes 1 shareable live signal.';
  return `Includes ${String(count)} shareable live signals.`;
};

type PublicCollectionMeta = {
  readonly title: string;
  readonly description: string;
  readonly url: string;
};

const htmlResponseWithMeta = async (
  indexResponse: Response,
  meta: PublicCollectionMeta,
): Promise<Response> => {
  const html = await indexResponse.text();
  const headers = new Headers(indexResponse.headers);
  headers.set('content-type', 'text/html; charset=utf-8');
  return new Response(injectPublicCollectionMeta(html, meta), {
    status: indexResponse.status,
    headers,
  });
};

export const injectPublicCollectionMeta = (html: string, meta: PublicCollectionMeta): string => {
  const tags = [
    `<title>${escapeHtml(meta.title)}</title>`,
    `<meta name="description" content="${escapeHtml(meta.description)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${escapeHtml(meta.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(meta.description)}" />`,
    `<meta property="og:url" content="${escapeHtml(meta.url)}" />`,
    `<meta property="og:site_name" content="${PRODUCT_NAME}" />`,
    `<meta name="twitter:card" content="summary" />`,
    `<meta name="twitter:title" content="${escapeHtml(meta.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(meta.description)}" />`,
  ].join('\n    ');

  const withoutDefaultTitle = html.replace(/<title>[\s\S]*?<\/title>/i, '');
  if (withoutDefaultTitle.includes('</head>')) {
    return withoutDefaultTitle.replace('</head>', `    ${tags}\n  </head>`);
  }
  return `${tags}\n${withoutDefaultTitle}`;
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
