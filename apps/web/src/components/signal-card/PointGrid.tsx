import type { DataPoint } from '../../api';
import { pointLabel, pointSourceUrl, pointValueText } from '../../signal-format';
import type { RenderSignal } from './types';

type Props = {
  readonly signal: RenderSignal;
  readonly points: ReadonlyArray<DataPoint>;
};

export function PointGrid({ signal, points }: Props) {
  return (
    <div class="mt-5 grid grid-cols-1 gap-x-4 gap-y-2.5 sm:grid-cols-2">
      {points.map((point, idx) => (
        <PointGridRow signal={signal} key={pointKey(point, idx)} point={point} />
      ))}
    </div>
  );
}

function PointGridRow({
  signal,
  point,
}: {
  readonly signal: RenderSignal;
  readonly point: DataPoint;
}) {
  const url = pointSourceUrl(point, signal);
  const row = <PointGridCells point={point} />;
  return url ? (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      class="-mx-1 flex items-baseline justify-between gap-2 rounded-md px-1 py-0.5 transition-colors hover:bg-slate-900/[0.03] focus:outline-none focus:ring-2 focus:ring-emerald-500/60 dark:hover:bg-white/5"
    >
      {row}
    </a>
  ) : (
    <div class="flex items-baseline justify-between gap-2">{row}</div>
  );
}

function PointGridCells({ point }: { readonly point: DataPoint }) {
  return (
    <>
      <span class="truncate text-xs text-slate-500 dark:text-slate-400">{pointLabel(point)}</span>
      <span class="min-w-0 truncate text-right text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
        {pointValueText(point)}
        {point.unit ? (
          <span class="ml-1 text-xs text-slate-400 dark:text-slate-500">{point.unit}</span>
        ) : null}
      </span>
    </>
  );
}

const pointKey = (point: DataPoint, idx: number): string => `${pointLabel(point)}-${String(idx)}`;
