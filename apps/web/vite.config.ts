import { defineConfig, type PluginOption } from 'vite';
import preact from '@preact/preset-vite';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

const sentryRelease =
  process.env.VITE_SENTRY_RELEASE ??
  process.env.SENTRY_RELEASE ??
  process.env.CF_PAGES_COMMIT_SHA ??
  process.env.GITHUB_SHA;

function sentryPlugins(): PluginOption[] {
  if (!process.env.SENTRY_AUTH_TOKEN || !sentryRelease) {
    return [];
  }

  return [
    sentryVitePlugin({
      org: process.env.SENTRY_ORG ?? 'your-sentry-org',
      project: process.env.SENTRY_PROJECT ?? 'antenna',
      url: process.env.SENTRY_URL ?? 'https://sentry.io',
      authToken: process.env.SENTRY_AUTH_TOKEN,
      release: {
        name: sentryRelease,
      },
      sourcemaps: {
        assets: './dist/**',
        filesToDeleteAfterUpload: ['./dist/**/*.map'],
      },
      telemetry: false,
    }) as PluginOption,
  ];
}

export default defineConfig({
  define: sentryRelease
    ? {
        'import.meta.env.VITE_SENTRY_RELEASE': JSON.stringify(sentryRelease),
      }
    : {},
  plugins: [
    preact(),
    tailwindcss(),
    // App-owned registration lets automatic and manual update checks share one path.
    // Exclude Worker routes; Workbox precaches static build output only.
    VitePWA({
      injectRegister: false,
      registerType: 'autoUpdate',
      pwaAssets: { disabled: true },
      includeAssets: [
        'favicon.ico',
        'favicon.svg',
        'apple-touch-icon-180x180.png',
        'pwa-64x64.png',
        'pwa-192x192.png',
        'pwa-512x512.png',
        'maskable-icon-512x512.png',
      ],
      manifest: {
        id: '/',
        name: 'Antenna',
        short_name: 'Antenna',
        description: 'Track the signals that matter.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#f3f7f4',
        theme_color: '#0b1624',
        orientation: 'any',
        categories: ['productivity', 'finance', 'news'],
        icons: [
          { src: '/pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/healthz$/, /^\/privacy\/?$/, /^\/terms\/?$/],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
      },
    }),
    ...sentryPlugins(),
  ],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8787',
      '/healthz': 'http://127.0.0.1:8787',
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: Boolean(process.env.SENTRY_AUTH_TOKEN),
  },
});
