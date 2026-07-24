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
    <section aria-label="Antenna preview" class="order-last min-w-0 lg:order-first">
      <PreviewHeading />
      <div class="antenna-panel rounded-2xl p-4">
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
      <p class="antenna-eyebrow flex items-center gap-2">
        <img src="/favicon.svg" alt="" class="h-7 w-7 rounded-lg shadow-sm" />
        <span>{PRODUCT_NAME}</span>
      </p>
      <h1 class="mt-2 max-w-2xl text-3xl font-semibold text-slate-950 sm:text-4xl dark:text-white">
        Track the signals that matter.
      </h1>
      <p class="mt-3 max-w-xl text-base leading-7 text-slate-600 dark:text-slate-300">
        A source-aware signal layer — inspectable in the browser and available to your agents over
        MCP.
      </p>
    </div>
  );
}

function PreviewCollectionHeader() {
  return (
    <div class="flex flex-col gap-3 border-b border-slate-900/10 pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
      <div>
        <p class="antenna-eyebrow">Daily collection</p>
        <p class="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
          Monday morning cockpit
        </p>
      </div>
      <div class="flex flex-wrap gap-2 text-xs">
        <span class="antenna-chip rounded-full px-2.5 py-1">SSE live</span>
        <span class="antenna-chip rounded-full px-2.5 py-1">Source aware</span>
      </div>
    </div>
  );
}

function PreviewCards() {
  return (
    <div class="mt-4 grid gap-3 sm:grid-cols-2">
      {previewCards.map((signal) => (
        <article key={signal.title} class="antenna-subpanel min-h-36 rounded-xl p-4">
          <div class="flex items-start justify-between gap-3">
            <h2 class="text-sm font-semibold text-slate-900 dark:text-white">{signal.title}</h2>
            <span class="antenna-meta rounded-full border border-slate-900/10 bg-white/70 px-2 py-0.5 text-[0.65rem] font-medium text-slate-500 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-300">
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
    <div class="antenna-console mt-4 rounded-xl p-4">
      <div class="mb-3 flex items-center justify-between gap-3">
        <p class="text-sm font-semibold">{SIGNAL_COMPOSER_TITLE}</p>
        <span class="antenna-meta text-[0.7rem] text-slate-400">Validated before apply</span>
      </div>
      <p class="rounded-lg bg-white/10 px-3 py-2 text-sm text-slate-200">
        "Add a signal for high severity npm advisories this week"
      </p>
      <div class="mt-3 grid gap-2 sm:grid-cols-3">
        {previewRows.map((row) => (
          <div
            key={row.label}
            class="antenna-meta flex items-center justify-between gap-2 rounded-lg border border-white/[0.05] bg-white/[0.06] px-3 py-2 text-[0.7rem]"
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
