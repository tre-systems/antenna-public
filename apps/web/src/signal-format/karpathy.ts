import type { DataPoint } from '../api';
import { rankOf } from './common';
import type { RenderSignal } from './types';
import { compactNumber, pointValueText } from './value';

export type KarpathyCardData = {
  readonly share: string;
  readonly highJobs: string;
  readonly totalJobs: string;
  readonly weighted: string;
  readonly occupations: string;
  readonly topRoles: ReadonlyArray<string>;
};

const TOP_ROLE_LIMIT = 5;

export function karpathyCardData(signal: RenderSignal): KarpathyCardData | null {
  if (signal.template_id !== 'karpathy-jobs-snapshot') return null;
  if (signal.points.length === 0) return null;
  const find = (metric: string): DataPoint | undefined => metricPoint(signal.points, metric);
  return {
    share: textOf(find('high_exposure_share')),
    weighted: textOf(find('weighted_ai_exposure')),
    occupations: textOf(find('occupations')),
    totalJobs: compactNumber(find('jobs_analyzed')?.value),
    highJobs: compactNumber(find('high_exposure_jobs')?.value),
    topRoles: topRolesFor(signal.points),
  };
}

const metricPoint = (points: ReadonlyArray<DataPoint>, metric: string): DataPoint | undefined =>
  points.find((p) => p.dimensions?.metric === metric);

const textOf = (point: DataPoint | undefined): string => (point ? pointValueText(point) : '—');

const topRolesFor = (points: ReadonlyArray<DataPoint>): ReadonlyArray<string> =>
  points
    .filter((p) => p.dimensions?.metric === 'top_role')
    .sort((a, b) => rankOf(a) - rankOf(b))
    .slice(0, TOP_ROLE_LIMIT)
    .map(topRoleTitle)
    .filter((title) => title.length > 0);

const topRoleTitle = (point: DataPoint): string => {
  const title = typeof point.value === 'string' ? point.value : point.value_text;
  return typeof title === 'string' ? title.trim() : '';
};
