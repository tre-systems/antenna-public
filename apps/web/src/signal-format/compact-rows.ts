import type { DataPoint } from '../api';
import { rankOf } from './common';
import { projectRow } from './compact-row-projectors';
import { summaryFor } from './compact-row-summary';
import type { CompactRow, CompactRowsCardData } from './compact-row-types';
import { compactRowLimit, isCompactRowsTemplate, isRowMetric } from './compact-row-types';
import type { RenderSignal } from './types';

export function compactRowsCardData(signal: RenderSignal): CompactRowsCardData | null {
  const tid = signal.template_id;
  if (!isCompactRowsTemplate(tid)) return null;
  const rowPoints = rankedRowPoints(signal.points, tid);
  const rows = projectedRows(signal, rowPoints);
  return { summary: summaryFor(signal, rows.length), rows };
}

const rankedRowPoints = (points: ReadonlyArray<DataPoint>, templateId: string): DataPoint[] =>
  points
    .filter((p) => isRowMetric(p.dimensions?.metric, templateId))
    .slice()
    .sort((a, b) => compareRows(a, b, templateId))
    .slice(0, compactRowLimit(templateId));

// Activity lists read best busiest-first; other lists keep the connector's ranking.
const VALUE_ORDERED_TEMPLATES = new Set(['project-portfolio', 'cloudflare-web-analytics']);

const compareRows = (a: DataPoint, b: DataPoint, templateId: string): number => {
  const rankDelta = rankOf(a) - rankOf(b);
  if (!VALUE_ORDERED_TEMPLATES.has(templateId)) return rankDelta;
  const coverageOrder =
    Number(a.dimensions?.telemetry_state === 'disabled') -
    Number(b.dimensions?.telemetry_state === 'disabled');
  if (coverageOrder) return coverageOrder;
  const valueDelta = Number(b.value) - Number(a.value);
  return valueDelta || rankDelta;
};

const projectedRows = (signal: RenderSignal, points: ReadonlyArray<DataPoint>): CompactRow[] => {
  const rows: CompactRow[] = [];
  for (const [idx, point] of points.entries()) {
    const projected = projectRow(signal, point, idx + 1);
    if (projected) rows.push(projected);
  }
  return rows;
};
