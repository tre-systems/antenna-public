import { StatusPill } from '../../components/signal-card/StatusPill';
import type { CardStatus } from '../../components/signal-card/types';

type PreviewSignalBase = {
  readonly id: string;
  readonly title: string;
  readonly source: string;
  readonly freshness: string;
  readonly status: CardStatus;
};

type PreviewMetricSignal = PreviewSignalBase & {
  readonly kind: 'metric';
  readonly value: string;
  readonly unit: string;
  readonly sparkline: 'up' | 'flat';
};

type PreviewTextSignal = PreviewSignalBase & {
  readonly kind: 'text';
  readonly value: string;
  readonly detail: string;
};

type PreviewRowsSignal = PreviewSignalBase & {
  readonly kind: 'rows';
  readonly rows: ReadonlyArray<{ readonly label: string; readonly chip: string }>;
};

type PreviewSignal = PreviewMetricSignal | PreviewTextSignal | PreviewRowsSignal;

const PREVIEW_SIGNALS: PreviewSignal[] = [
  {
    kind: 'text',
    id: 'health',
    title: 'Applications',
    source: 'Health probes',
    freshness: '1m ago',
    status: 'live',
    value: '6 healthy',
    detail: 'No changes since the last report',
  },
  {
    kind: 'metric',
    id: 'visits',
    title: 'Browser visits',
    source: 'Cloudflare Web Analytics',
    freshness: '10m ago',
    status: 'live',
    value: '842',
    unit: 'visits',
    sparkline: 'up',
  },
  {
    kind: 'metric',
    id: 'actions',
    title: 'Product actions',
    source: 'Analytics Engine',
    freshness: '10m ago',
    status: 'live',
    value: '1,284',
    unit: 'events',
    sparkline: 'flat',
  },
  {
    kind: 'rows',
    id: 'projects',
    title: 'Project activity',
    source: 'GitHub',
    freshness: '12m ago',
    status: 'live',
    rows: [
      { label: 'Recent releases', chip: '2 new' },
      { label: 'Security advisories', chip: '1 review' },
    ],
  },
];

const SPARKLINE_PATHS = {
  up: 'M 4 28 L 14 22 L 24 24 L 34 14 L 44 18 L 54 10 L 64 12',
  flat: 'M 4 18 L 18 17 L 32 19 L 46 18 L 64 17',
} as const;

export function CollectionPreview() {
  return (
    <div
      class="antenna-panel rounded-2xl p-4 lg:col-start-1 lg:row-start-2"
      data-testid="sign-in-collection-preview"
      aria-label="Example collection preview"
    >
      <PreviewHeader />
      <div class="mt-4 grid gap-3 sm:grid-cols-2">
        {PREVIEW_SIGNALS.map((signal) => (
          <PreviewSignalCard key={signal.id} signal={signal} />
        ))}
      </div>
      <AgentAccessPreview />
    </div>
  );
}

function PreviewHeader() {
  return (
    <div class="flex flex-col gap-3 border-b border-slate-900/10 pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
      <div>
        <p class="antenna-eyebrow">Example collection</p>
        <h2 class="mt-1 text-lg font-semibold text-slate-950 dark:text-white">Daily signals</h2>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Illustrative data — every observation keeps its source and freshness.
        </p>
      </div>
      <div class="flex flex-wrap gap-2 text-xs">
        <span class="antenna-chip rounded-full px-2.5 py-1">PWA view</span>
        <span class="antenna-chip rounded-full px-2.5 py-1">MCP access</span>
      </div>
    </div>
  );
}

function PreviewSignalCard({ signal }: { readonly signal: PreviewSignal }) {
  return (
    <article
      class="antenna-panel antenna-card rounded-2xl p-4"
      data-testid={`preview-signal-${signal.id}`}
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

function renderSignalBody(signal: PreviewSignal) {
  if (signal.kind === 'metric') return <MetricBody signal={signal} />;
  if (signal.kind === 'rows') return <RowsBody signal={signal} />;
  return (
    <div>
      <p class="text-lg font-semibold text-slate-900 dark:text-white">{signal.value}</p>
      <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">{signal.detail}</p>
    </div>
  );
}

function MetricBody({ signal }: { readonly signal: PreviewMetricSignal }) {
  return (
    <div class="flex items-end gap-3">
      <p class="min-w-0 flex-1">
        <span class="text-2xl font-semibold tracking-tight tabular-nums text-slate-900 dark:text-white">
          {signal.value}
        </span>
        <span class="ml-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
          {signal.unit}
        </span>
      </p>
      <PreviewSparkline trend={signal.sparkline} />
    </div>
  );
}

function RowsBody({ signal }: { readonly signal: PreviewRowsSignal }) {
  return (
    <ul class="mt-1 space-y-2">
      {signal.rows.map((row) => (
        <li key={row.label} class="flex min-w-0 items-center gap-2">
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

function PreviewSparkline({ trend }: { readonly trend: keyof typeof SPARKLINE_PATHS }) {
  return (
    <svg
      class="h-10 w-24 shrink-0 text-emerald-600 dark:text-emerald-300"
      viewBox="0 0 68 32"
      aria-hidden="true"
    >
      <path
        d={SPARKLINE_PATHS[trend]}
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

function AgentAccessPreview() {
  return (
    <div class="antenna-subpanel mt-4 rounded-xl p-4" data-testid="agent-access-preview">
      <div class="flex items-center justify-between gap-3">
        <p class="text-sm font-semibold text-slate-900 dark:text-white">Built for your agents</p>
        <span class="antenna-meta text-[0.7rem] text-slate-500 dark:text-slate-400">MCP</span>
      </div>
      <p class="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
        Your agent can inspect health and changes, use the collection in a recurring report, and
        configure new signals when you ask.
      </p>
      <div class="mt-3 flex flex-wrap gap-2">
        <span class="antenna-chip rounded-full px-2.5 py-1 text-[0.7rem]">Owner-scoped</span>
        <span class="antenna-chip rounded-full px-2.5 py-1 text-[0.7rem]">Source-aware</span>
      </div>
    </div>
  );
}
