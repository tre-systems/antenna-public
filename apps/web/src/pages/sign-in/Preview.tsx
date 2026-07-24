import { PRODUCT_NAME, SIGNAL_COMPOSER_TITLE } from '../../brand';

const previewCards = [
  {
    title: 'Market pulse',
    eyebrow: 'Live',
    value: 'BTC, GBP, gold',
    detail: 'Source links and freshness on every signal',
  },
  {
    title: 'Watchlist',
    eyebrow: 'Year view',
    value: 'AZN.L  VTI  SHEL.L',
    detail: 'Daily points with clean setup states',
  },
  {
    title: 'AI radar',
    eyebrow: 'Updated',
    value: 'GitHub, jobs, benchmarks',
    detail: 'Reviewed sources, not fragile page copies',
  },
  {
    title: 'Ops radar',
    eyebrow: 'Fresh',
    value: 'Incidents, advisories, KEV',
    detail: 'Security and platform signals without private account access',
  },
] as const;

const previewRows = [
  { label: 'GitHub Trending', state: 'fresh' },
  { label: 'UK economic calendar', state: 'setup' },
  { label: 'Cloudflare incidents', state: 'fresh' },
] as const;

export function SignInPreview() {
  return (
    <section aria-label="Antenna preview" class="min-w-0">
      <PreviewHeading />
      <div class="rounded-2xl bg-white/70 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_24px_64px_-24px_rgba(13,148,136,0.18)] ring-1 ring-slate-900/5 backdrop-blur-xl dark:bg-white/[0.04] dark:ring-white/10 dark:shadow-[0_1px_2px_rgba(0,0,0,0.4),0_24px_64px_-24px_rgba(14,165,233,0.24)]">
        <PreviewCollectionHeader />
        <PreviewCards />
        <AskPreview />
      </div>
    </section>
  );
}

function PreviewHeading() {
  return (
    <div class="mb-6">
      <p class="flex items-center gap-2 text-sm font-semibold text-teal-700 dark:text-teal-200">
        <img src="/favicon.svg" alt="" class="h-6 w-6 rounded-lg shadow-sm" />
        <span class="bg-gradient-to-r from-teal-700 to-sky-700 bg-clip-text text-transparent dark:from-teal-200 dark:to-sky-200">
          {PRODUCT_NAME}
        </span>
      </p>
      <h1 class="mt-2 max-w-2xl text-3xl font-semibold text-slate-950 sm:text-4xl dark:text-white">
        Track the signals that matter.
      </h1>
      <p class="mt-3 max-w-xl text-base text-slate-500 dark:text-slate-300">
        Your private signal layer — live in the browser and wired into your agents over MCP.
      </p>
    </div>
  );
}

function PreviewCollectionHeader() {
  return (
    <div class="flex flex-col gap-3 border-b border-slate-900/10 pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
      <div>
        <p class="text-xs font-medium uppercase text-slate-400 dark:text-slate-500">
          Daily Collection
        </p>
        <p class="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
          Monday morning cockpit
        </p>
      </div>
      <div class="flex flex-wrap gap-2 text-xs">
        <span class="rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-400/20">
          SSE live
        </span>
        <span class="rounded-full bg-sky-50 px-2.5 py-1 font-medium text-sky-700 ring-1 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-200 dark:ring-sky-400/20">
          Source aware
        </span>
      </div>
    </div>
  );
}

function PreviewCards() {
  return (
    <div class="mt-4 grid gap-3 sm:grid-cols-2">
      {previewCards.map((signal) => (
        <article
          key={signal.title}
          class="min-h-36 rounded-xl bg-slate-50/80 p-4 ring-1 ring-slate-900/5 dark:bg-slate-950/45 dark:ring-white/10"
        >
          <div class="flex items-start justify-between gap-3">
            <h2 class="text-sm font-semibold text-slate-900 dark:text-white">{signal.title}</h2>
            <span class="rounded-full bg-white px-2 py-0.5 text-[0.7rem] font-medium text-slate-500 ring-1 ring-slate-900/10 dark:bg-white/[0.06] dark:text-slate-300 dark:ring-white/10">
              {signal.eyebrow}
            </span>
          </div>
          <p class="mt-5 text-xl font-semibold text-slate-950 dark:text-white">{signal.value}</p>
          <p class="mt-2 text-sm leading-5 text-slate-500 dark:text-slate-400">{signal.detail}</p>
        </article>
      ))}
    </div>
  );
}

function AskPreview() {
  return (
    <div class="mt-4 rounded-xl bg-slate-950 p-4 text-white shadow-inner dark:bg-black/30">
      <div class="mb-3 flex items-center justify-between gap-3">
        <p class="text-sm font-semibold">{SIGNAL_COMPOSER_TITLE}</p>
        <span class="text-xs text-slate-400">Validated before apply</span>
      </div>
      <p class="rounded-lg bg-white/10 px-3 py-2 text-sm text-slate-200">
        "Add a signal for high severity npm advisories this week"
      </p>
      <div class="mt-3 grid gap-2 sm:grid-cols-3">
        {previewRows.map((row) => (
          <div
            key={row.label}
            class="flex items-center justify-between gap-2 rounded-lg bg-white/[0.06] px-3 py-2 text-xs"
          >
            <span class="truncate text-slate-200">{row.label}</span>
            <span
              class={
                row.state === 'fresh' ? 'shrink-0 text-emerald-300' : 'shrink-0 text-amber-300'
              }
            >
              {row.state}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
