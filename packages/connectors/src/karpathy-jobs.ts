import { stringValue } from './config-values';
import { fetchJson } from './fetch-json';
import type { Adapter, AdapterResult, DataPoint } from './types';

type KarpathyJobsConfig = {
  readonly sourceUrl?: string;
};

type JobRow = {
  readonly title?: unknown;
  readonly category?: unknown;
  readonly pay?: unknown;
  readonly jobs?: unknown;
  readonly outlook?: unknown;
  readonly exposure?: unknown;
  readonly url?: unknown;
};

type NormalisedJob = {
  readonly title: string;
  readonly category: string;
  readonly jobs: number;
  readonly pay?: number;
  readonly outlook?: number;
  readonly exposure: number;
  readonly url?: string;
};

const DEFAULT_SOURCE = 'https://karpathy.ai/jobs/data.json';
const SOURCE_PAGE = 'https://karpathy.ai/jobs/';
const HIGH_EXPOSURE_THRESHOLD = 7;

export const karpathyJobs: Adapter<KarpathyJobsConfig> = async (config): Promise<AdapterResult> => {
  const url =
    typeof config.sourceUrl === 'string' && config.sourceUrl ? config.sourceUrl : DEFAULT_SOURCE;

  const fetched = await fetchJson(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'antenna' },
  });
  if (!fetched.ok) return fetched;

  const jobs = normaliseJobs(fetched.body);
  if (jobs.length === 0) {
    return { ok: false, error: { code: 'parse_failed', message: 'no jobs parsed' } };
  }

  const summary = summariseJobs(jobs);
  const topRoles = topHighExposureRoles(jobs);
  const ts = Date.now();
  return {
    ok: true,
    points: [...summaryToPoints(summary, ts), ...topRolePoints(topRoles, ts)],
    rawPayload: {
      source: url,
      sourcePage: SOURCE_PAGE,
      summary,
      topHighExposureRoles: topRoles,
    },
  };
};

export const normaliseJobs = (body: unknown): NormalisedJob[] => {
  if (!Array.isArray(body)) return [];
  return body.flatMap((row) => {
    if (!row || typeof row !== 'object') return [];
    const job = row as JobRow;
    const title = stringValue(job.title);
    const category = stringValue(job.category);
    const jobs = numberValue(job.jobs);
    const exposure = numberValue(job.exposure);
    if (!title || !category || jobs === undefined || exposure === undefined) return [];
    const pay = numberValue(job.pay);
    const outlook = numberValue(job.outlook);
    const url = stringValue(job.url);
    return [
      {
        title,
        category,
        jobs,
        exposure,
        ...(pay !== undefined ? { pay } : {}),
        ...(outlook !== undefined ? { outlook } : {}),
        ...(url ? { url } : {}),
      },
    ];
  });
};

type JobSummary = {
  readonly occupations: number;
  readonly totalJobs: number;
  readonly weightedExposure: number;
  readonly highExposureJobs: number;
  readonly highExposureShare: number;
};

export const summariseJobs = (jobs: readonly NormalisedJob[]): JobSummary => {
  const totalJobs = jobs.reduce((sum, job) => sum + job.jobs, 0);
  const weightedExposure =
    totalJobs === 0 ? 0 : jobs.reduce((sum, job) => sum + job.exposure * job.jobs, 0) / totalJobs;
  const highExposureJobs = jobs
    .filter((job) => job.exposure >= HIGH_EXPOSURE_THRESHOLD)
    .reduce((sum, job) => sum + job.jobs, 0);
  const highExposureShare = totalJobs === 0 ? 0 : (highExposureJobs / totalJobs) * 100;
  return {
    occupations: jobs.length,
    totalJobs,
    weightedExposure,
    highExposureJobs,
    highExposureShare,
  };
};

const summaryToPoints = (summary: JobSummary, ts: number): DataPoint[] => [
  { dimensions: { metric: 'occupations' }, value: summary.occupations, ts, sourceUrl: SOURCE_PAGE },
  {
    dimensions: { metric: 'jobs_analyzed' },
    value: summary.totalJobs,
    unit: 'jobs',
    ts,
    sourceUrl: SOURCE_PAGE,
  },
  {
    dimensions: { metric: 'weighted_ai_exposure' },
    value: `${summary.weightedExposure.toFixed(1)} / 10`,
    ts,
    sourceUrl: SOURCE_PAGE,
  },
  {
    dimensions: { metric: 'high_exposure_jobs' },
    value: summary.highExposureJobs,
    unit: 'jobs',
    ts,
    sourceUrl: SOURCE_PAGE,
  },
  {
    dimensions: { metric: 'high_exposure_share' },
    value: `${summary.highExposureShare.toFixed(0)}%`,
    ts,
    sourceUrl: SOURCE_PAGE,
  },
];

const topHighExposureRoles = (jobs: readonly NormalisedJob[]): NormalisedJob[] =>
  [...jobs]
    .filter((job) => job.exposure >= HIGH_EXPOSURE_THRESHOLD)
    .sort((a, b) => b.jobs - a.jobs)
    .slice(0, 10);

const topRolePoints = (roles: readonly NormalisedJob[], ts: number): DataPoint[] =>
  roles.map((role, index) => ({
    dimensions: {
      metric: 'top_role',
      rank: index + 1,
      category: role.category,
      jobs: role.jobs,
      exposure: role.exposure,
    },
    value: role.title,
    unit: role.pay !== undefined ? `median pay ${formatUsd(role.pay)}` : undefined,
    ts,
    sourceUrl: role.url ?? SOURCE_PAGE,
  }));

const formatUsd = (value: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);

const numberValue = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;
