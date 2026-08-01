import { StatusPill } from '../../components/signal-card/StatusPill';
import type { CardStatus } from '../../components/signal-card/types';

type DemoPointSignal = {
  readonly kind: 'point';
  readonly id: string;
  readonly title: string;
  readonly source: string;
  readonly freshness: string;
  readonly status: CardStatus;
  readonly value: string;
  readonly unit?: string;
  readonly sparkline: 'up' | 'down' | 'flat';
};

type DemoRowsSignal = {
  readonly kind: 'rows';
  readonly id: string;
  readonly title: string;
  readonly source: string;
  readonly freshness: string;
  readonly status: CardStatus;
  readonly rows: ReadonlyArray<{
    readonly rank: number;
    readonly label: string;
    readonly chip: string;
  }>;
};

type DemoTextSignal = {
  readonly kind: 'text';
  readonly id: string;
  readonly title: string;
  readonly source: string;
  readonly freshness: string;
  readonly status: CardStatus;
  readonly value: string;
  readonly detail: string;
};

type DemoSignal = DemoPointSignal | DemoRowsSignal | DemoTextSignal;

const demoSignals: DemoSignal[] = [
  {
    kind: 'point',
    id: 'btc',
    title: 'BTC/USD',
    source: 'CoinGecko',
    freshness: '3m ago',
    status: 'live',
    value: '67,420',
    unit: 'USD',
    sparkline: 'up',
  },
  {
    kind: 'point',
    id: 'gbp',
    title: 'GBP/USD',
    source: 'Frankfurter (ECB)',
    freshness: '5m ago',
    status: 'live',
    value: '1.27',
    sparkline: 'flat',
  },
  {
    kind: 'rows',
    id: 'github',
    title: 'GitHub Trending',
    source: 'GitHub',
    freshness: '12m ago',
    status: 'live',
    rows: [
      { rank: 1, label: 'vitejs/vite', chip: '+842' },
      { rank: 2, label: 'rust-lang/rust', chip: '+516' },
    ],
  },
  {
    kind: 'text',
    id: 'cloudflare',
    title: 'Cloudflare incidents',
    source: 'Cloudflare Status',
    freshness: '8m ago',
    status: 'live',
    value: 'No active incidents',
    detail: 'Last resolved 2d ago',
  },
];

const sparklinePaths = {
  up: 'M 4 28 L 14 22 L 24 24 L 34 14 L 44 18 L 54 10 L 64 12',
  down: 'M 4 10 L 14 14 L 24 12 L 34 20 L 44 16 L 54 24 L 64 22',
  flat: 'M 4 18 L 18 17 L 32 19 L 46 18 L 64 17',
} as const;

export function DemoDashboard() {
  return (
    <div
      class="antenna-panel rounded-2xl p-4"
      data-testid="sign-in-demo-dashboard"
      aria-label="Sample collection preview"
    >
      <DemoCollectionHeader />
      <div class="mt-4 grid gap-3 sm:grid-cols-2">
        {demoSignals.map((signal) => (
          <DemoSignalCard key={signal.id} signal={signal} />
        ))}
      </div>
      <DemoComposer />
    </div>
  );
}

function DemoCollectionHeader() {
  return (
    <div class="flex flex-col gap-3 border-b border-slate-900/10 pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
      <div>
        <p class="antenna-eyebrow">Demo collection</p>
        <h2 class="mt-1 text-lg font-semibold text-slate-950 dark:text-white">Morning briefing</h2>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Fictional signals for preview — your collection stays private after sign-in.
        </p>
      </div>
      <div class="flex flex-wrap gap-2 text-xs">
        <span class="antenna-chip rounded-full px-2.5 py-1">SSE live</span>
        <span class="antenna-chip rounded-full px-2.5 py-1">4 signals</span>
      </div>
    </div>
  );
}

function DemoSignalCard({ signal }: { readonly signal: DemoSignal }) {
  return (
    <article
      class="antenna-panel antenna-card rounded-2xl p-4"
      data-testid={`demo-signal-${signal.id}`}
    >
      <header class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <h3 class="line-clamp-2 text-base font-semibold leading-tight tracking-tight text-slate-900 dark:text-white">
            {signal.title}
          </h3>
          <p class="antenna-meta mt-1 text-[0.68rem] text-slate-500 dark:text-slate-400">
            {signal.source}
            <span class="mx-1 text-slate-300 dark:text-slate-600" aria-hidden="true">
              ·
            </span>
            <time>{signal.freshness}</time>
          </p>
        </div>
        <StatusPill status={signal.status} />
      </header>
      <div class="mt-2">{renderSignalBody(signal)}</div>
    </article>
  );
}

function renderSignalBody(signal: DemoSignal) {
  if (signal.kind === 'point') {
    return (
      <div class="flex items-end gap-3">
        <p class="min-w-0 flex-1">
          <span class="text-2xl font-semibold tracking-tight tabular-nums text-slate-900 dark:text-white">
            {signal.value}
          </span>
          {signal.unit ? (
            <span class="ml-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
              {signal.unit}
            </span>
          ) : null}
        </p>
        <DemoSparkline trend={signal.sparkline} />
      </div>
    );
  }

  if (signal.kind === 'rows') {
    return (
      <ul class="mt-1 space-y-2">
        {signal.rows.map((row) => (
          <li key={row.rank} class="flex min-w-0 items-center gap-2">
            <span class="w-6 shrink-0 text-xs font-semibold tabular-nums text-slate-400 dark:text-slate-500">
              #{row.rank}
            </span>
            <span class="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900 dark:text-white">
              {row.label}
            </span>
            <span class="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
              {row.chip}
            </span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div>
      <p class="text-lg font-semibold text-slate-900 dark:text-white">{signal.value}</p>
      <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">{signal.detail}</p>
    </div>
  );
}

function DemoSparkline({ trend }: { readonly trend: keyof typeof sparklinePaths }) {
  return (
    <svg
      class="h-10 w-24 shrink-0 text-emerald-600 dark:text-emerald-300"
      viewBox="0 0 68 32"
      role="img"
      aria-hidden="true"
    >
      <path
        d={sparklinePaths[trend]}
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        vector-effect="non-scaling-stroke"
      />
    </svg>
  );
}

function DemoComposer() {
  return (
    <div class="antenna-subpanel mt-4 rounded-xl p-4" data-testid="demo-composer">
      <div class="flex items-center justify-between gap-3">
        <p class="text-sm font-semibold text-slate-900 dark:text-white">Agent proposal</p>
        <span class="antenna-meta text-[0.7rem] text-slate-500 dark:text-slate-400">
          Approval required
        </span>
      </div>
      <p class="mt-3 rounded-lg border border-slate-900/10 bg-white/70 px-3 py-2 text-sm text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
        Add high-severity npm advisories from the last 7 days
      </p>
      <div class="mt-3 flex flex-wrap gap-2">
        <span class="antenna-chip rounded-full px-2.5 py-1 text-[0.7rem]">
          github-security-advisories
        </span>
        <span class="antenna-chip rounded-full px-2.5 py-1 text-[0.7rem]">Weekly cadence</span>
      </div>
    </div>
  );
}
