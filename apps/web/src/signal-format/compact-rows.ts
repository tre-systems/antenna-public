import type { DataPoint } from '../api';
import { numOf } from './common';
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
    .sort((a, b) => numOf(a.dimensions?.rank) - numOf(b.dimensions?.rank))
    .slice(0, compactRowLimit(templateId));

const projectedRows = (signal: RenderSignal, points: ReadonlyArray<DataPoint>): CompactRow[] => {
  const rows: CompactRow[] = [];
  for (const [idx, point] of points.entries()) {
    const projected = projectRow(signal, point, idx + 1);
    if (projected) rows.push(projected);
  }
  return rows;
};
