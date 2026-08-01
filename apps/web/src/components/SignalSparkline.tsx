import { useEffect, useState } from 'preact/hooks';
import { getSignalHistory, type ApiSignal, type HistoryPoint } from '../api';
import { pointLabel } from '../signal-format';
import { SparklineFigure } from './signal-sparkline/SparklineFigure';
import { SparklinePresentationFigure } from './signal-sparkline/SparklinePresentationFigure';
import { SparklineSummaryFigure } from './signal-sparkline/SparklineSummaryFigure';
import { bestSeries, pointTimestamp } from './signal-sparkline/history';
import { shouldFetchHistory } from './signal-sparkline/templates';

export { sparklinePath } from './signal-sparkline/geometry';
export { changeColour, spanLabelFor } from './signal-sparkline/labels';
export { DEFAULT_SPARKLINE_RANGE, filterSeriesForRange } from './signal-sparkline/ranges';
export { pointTimestamp };

export function SignalSparkline({
  signal,
  compact = false,
  variant,
}: {
  signal: ApiSignal;
  readonly compact?: boolean;
  readonly variant?: 'detail' | 'summary' | 'presentation';
}) {
  const [history, setHistory] = useState<HistoryPoint[] | null>(null);
  const signalId = signal.id;
  const lastOk = signal.status.last_ok_at;
  const fetchHistory = shouldFetchHistory(signal.template_id);

  useEffect(() => {
    if (!fetchHistory) return;
    let cancelled = false;
    void getSignalHistory(signalId)
      .then((res) => {
        if (!cancelled) setHistory(res.points);
      })
      .catch(() => {
        if (!cancelled) setHistory([]);
      });
    return () => {
      cancelled = true;
    };
  }, [signalId, fetchHistory, lastOk]);

  if (!fetchHistory || history === null) return null;
  const watchlist = signal.template_id === 'equity-watchlist';
  const series = bestSeries(history, {
    groupByLabel: watchlist,
    preferredLabel: watchlist && signal.points[0] ? pointLabel(signal.points[0]) : null,
  });
  if (series.points.length < 2) return null;

  const resolvedVariant = variant ?? (compact ? 'summary' : 'detail');
  if (resolvedVariant === 'presentation') {
    return <SparklinePresentationFigure label={series.label} points={series.points} />;
  }
  if (resolvedVariant === 'summary') {
    return <SparklineSummaryFigure label={series.label} points={series.points} />;
  }
  return <SparklineFigure label={series.label} points={series.points} compact={compact} />;
}
