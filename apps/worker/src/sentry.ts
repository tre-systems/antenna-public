import type { CloudflareOptions } from '@sentry/cloudflare';
import type { WorkerEnv } from './env';
import { beforeSend } from './sentry-redaction';

type RuntimeCloudflareOptions = CloudflareOptions & Record<string, unknown>;
type BeforeSendSpan = NonNullable<CloudflareOptions['beforeSendSpan']>;
type BeforeSendTransaction = NonNullable<CloudflareOptions['beforeSendTransaction']>;
type BeforeBreadcrumb = NonNullable<CloudflareOptions['beforeBreadcrumb']>;

const PRODUCTION_TRACE_SAMPLE_RATE = 0.002;
const NON_PRODUCTION_TRACE_SAMPLE_RATE = 0;
// Every dispatch tick writes these tables, so their auto-instrumented root
// transactions would dominate the trace quota without telling us anything.
const LOW_VALUE_D1_TRANSACTION_TABLES = new Set(['signal_points', 'signal_status']);

const SQL_TABLE_PATTERNS = [
  {
    operation: 'insert',
    pattern: /^\s*insert\s+(?:or\s+\w+\s+)?into\s+["`[]?([a-z0-9_]+)["`\]]?/i,
  },
  {
    operation: 'update',
    pattern: /^\s*update\s+["`[]?([a-z0-9_]+)["`\]]?/i,
  },
  {
    operation: 'delete',
    pattern: /^\s*delete\s+from\s+["`[]?([a-z0-9_]+)["`\]]?/i,
  },
  {
    operation: 'select',
    pattern: /^\s*select\b[\s\S]*?\bfrom\s+["`[]?([a-z0-9_]+)["`\]]?/i,
  },
] as const;

const parseTraceSampleRate = (value: string | undefined): number | undefined => {
  if (value === undefined || value.trim() === '') {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return Math.min(1, Math.max(0, parsed));
};

const traceSampleRate = (env: WorkerEnv): number => {
  const configured = parseTraceSampleRate(env.SENTRY_TRACES_SAMPLE_RATE);
  if (configured !== undefined) {
    return configured;
  }

  return (env.SENTRY_ENVIRONMENT ?? 'production') === 'production'
    ? PRODUCTION_TRACE_SAMPLE_RATE
    : NON_PRODUCTION_TRACE_SAMPLE_RATE;
};

const normalizeWhitespace = (value: string): string => value.replace(/\s+/g, ' ').trim();

const parseSqlOperation = (
  name: string,
): { readonly operation: string; readonly table: string } | undefined => {
  for (const { operation, pattern } of SQL_TABLE_PATTERNS) {
    const match = pattern.exec(name);
    const table = match?.[1]?.toLowerCase();
    if (table) {
      return { operation, table };
    }
  }

  return undefined;
};

export const normalizeTransactionName = (name: string | undefined): string | undefined => {
  if (!name) {
    return name;
  }

  const normalized = normalizeWhitespace(name);
  if (/^scheduled cron\b/i.test(normalized)) {
    return 'Scheduled cron tick';
  }

  const sqlOperation = parseSqlOperation(normalized);
  if (sqlOperation) {
    return `D1 ${sqlOperation.operation} ${sqlOperation.table}`;
  }

  return normalized;
};

export const isLowValueD1TransactionName = (name: string | undefined): boolean => {
  if (!name) {
    return false;
  }

  const sqlOperation = parseSqlOperation(name);
  if (!sqlOperation) {
    return false;
  }

  return (
    (sqlOperation.operation === 'insert' || sqlOperation.operation === 'update') &&
    LOW_VALUE_D1_TRANSACTION_TABLES.has(sqlOperation.table)
  );
};

export const beforeSendSpan: BeforeSendSpan = (span) => {
  const description = normalizeTransactionName(span.description);
  if (span.op === 'db.query') {
    return { ...span, description, data: {} };
  }
  if (!description || description === span.description) {
    return span;
  }

  return { ...span, description };
};

export const beforeSendTransaction: BeforeSendTransaction = (event, _hint) => {
  if (isLowValueD1TransactionName(event.transaction)) {
    return null;
  }

  const transaction = normalizeTransactionName(event.transaction);
  if (transaction && transaction !== event.transaction) {
    event.transaction = transaction;
    event.transaction_info = { source: 'custom' };
  }

  if (event.spans) {
    event.spans = event.spans.map((span) => beforeSendSpan(span));
  }

  return event;
};

export const beforeBreadcrumb: BeforeBreadcrumb = (breadcrumb, _hint) => {
  if (breadcrumb.category !== 'query' || !breadcrumb.message) {
    return breadcrumb;
  }

  const message = normalizeTransactionName(breadcrumb.message);
  return { ...breadcrumb, message, data: undefined };
};

export function sentryOptions(env: WorkerEnv): RuntimeCloudflareOptions | undefined {
  if (!env.SENTRY_DSN) {
    return undefined;
  }

  return {
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT ?? 'production',
    release: env.SENTRY_RELEASE,
    sendDefaultPii: false,
    tracesSampleRate: traceSampleRate(env),
    enableRpcTracePropagation: true,
    ignoreSpans: [
      {
        op: 'db.query',
        name: /^\s*(?:insert|update)\b[\s\S]*\b(?:signal_points|signal_status)\b/i,
        attributes: { 'sentry.origin': 'auto.db.cloudflare.d1' },
      },
    ],
    beforeSend,
    beforeSendSpan,
    beforeSendTransaction,
    beforeBreadcrumb,
  };
}
