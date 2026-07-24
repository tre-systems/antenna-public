import type { DataPoint } from '../../api';
import {
  airQualityCardData,
  appUsageCardData,
  cloudflareFleetCardData,
  costCardData,
  compactRowsCardData,
  githubTrendingCardData,
  karpathyCardData,
  weatherCardData,
  type CompactRowsCardData,
} from '../../signalFormat';
import { AirQualityHero } from './AirQualityHero';
import { AppUsageHero } from './AppUsageHero';
import { CloudflareFleetHero } from './CloudflareFleetHero';
import { CostHero } from './CostHero';
import { CompactRowsHero } from './CompactRowsHero';
import { GitHubTrendingList } from './GitHubTrendingList';
import { HeroValue } from './HeroValue';
import { KarpathyHero } from './KarpathyHero';
import { PointGrid } from './PointGrid';
import { WeatherHero } from './WeatherHero';
import type { CardStatus, RenderSignal } from './types';

type Props = {
  readonly signal: RenderSignal;
  readonly cardStatus: CardStatus;
  readonly points: ReadonlyArray<DataPoint>;
  readonly presentation?: boolean;
  // When set (presentation mode), list-style heroes are capped to this many
  // rows so a slide stays readable from across a room.
  readonly maxRows?: number;
};

export function SignalCardBody({
  signal,
  cardStatus,
  points,
  presentation = false,
  maxRows,
}: Props) {
  const shownPoints = maxRows == null ? points : points.slice(0, maxRows);
  if (shownPoints.length === 0) return <EmptySignalContent cardStatus={cardStatus} />;
  return (
    <LoadedSignalContent
      signal={signal}
      points={shownPoints}
      presentation={presentation}
      maxRows={maxRows}
    />
  );
}

function EmptySignalContent({ cardStatus }: { readonly cardStatus: CardStatus }) {
  if (cardStatus === 'error' || cardStatus === 'setup') return null;
  // 'loading' means the signal has never fetched yet (a brand-new signal), so
  // reassure that the first update is on its way rather than implying a stall.
  const copy =
    cardStatus === 'loading'
      ? 'Fetching the first update…'
      : cardStatus === 'stale'
        ? 'Waiting for a fresh update…'
        : 'Waiting for the next tick…';
  return (
    <p class="mt-5 flex items-center gap-2 text-sm italic text-slate-400 dark:text-slate-500">
      <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-300 dark:bg-slate-600" />
      {copy}
    </p>
  );
}

function LoadedSignalContent({
  signal,
  points,
  presentation,
  maxRows,
}: {
  readonly signal: RenderSignal;
  readonly points: ReadonlyArray<DataPoint>;
  readonly presentation: boolean;
  readonly maxRows?: number;
}) {
  const sourceContent = sourceSpecificContent(signal, maxRows);
  if (sourceContent) return sourceContent;

  const firstPoint = points[0] ?? null;
  if (points.length === 1 && firstPoint) {
    return <HeroValue point={firstPoint} presentation={presentation} />;
  }
  return <PointGrid signal={signal} points={points} />;
}

function sourceSpecificContent(signal: RenderSignal, maxRows?: number) {
  const costData = costCardData(signal);
  if (costData) return <CostHero data={costData} />;

  const appUsageData = appUsageCardData(signal);
  if (appUsageData) return <AppUsageHero data={appUsageData} />;

  const fleetData = cloudflareFleetCardData(signal);
  if (fleetData) return <CloudflareFleetHero data={fleetData} />;

  const githubTrendingRows = githubTrendingCardData(signal);
  if (githubTrendingRows) return <GitHubTrendingList rows={capList(githubTrendingRows, maxRows)} />;

  const karpathyData = karpathyCardData(signal);
  if (karpathyData)
    return <KarpathyContent signal={signal} data={karpathyData} maxRows={maxRows} />;

  const weatherData = weatherCardData(signal);
  if (weatherData) return <WeatherHero data={weatherData} />;

  const airQualityData = airQualityCardData(signal);
  if (airQualityData) return <AirQualityHero data={airQualityData} />;

  const compactRowsData = compactRowsCardData(signal);
  if (compactRowsData) return <CompactRowsHero data={capRows(compactRowsData, maxRows)} />;

  return null;
}

function KarpathyContent({
  signal,
  data,
  maxRows,
}: {
  readonly signal: RenderSignal;
  readonly data: NonNullable<ReturnType<typeof karpathyCardData>>;
  readonly maxRows?: number;
}) {
  const compactRowsData = compactRowsCardData(signal);
  return (
    <>
      <KarpathyHero data={data} />
      {compactRowsData ? <CompactRowsHero data={capRows(compactRowsData, maxRows)} /> : null}
    </>
  );
}

function capList<T>(rows: ReadonlyArray<T>, maxRows?: number): ReadonlyArray<T> {
  return maxRows == null ? rows : rows.slice(0, maxRows);
}

function capRows(data: CompactRowsCardData, maxRows?: number): CompactRowsCardData {
  return maxRows == null ? data : { ...data, rows: data.rows.slice(0, maxRows) };
}
