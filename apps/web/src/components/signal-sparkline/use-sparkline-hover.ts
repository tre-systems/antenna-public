import { useMemo, useRef, useState } from 'preact/hooks';
import { nearestPointIndex, projectX, projectY, seriesBounds, tooltipLeftForX } from './geometry';
import { SPARKLINE_PAD, SPARKLINE_WIDTH, type SeriesPoint } from './types';

export type SparklineHover = {
  readonly point: SeriesPoint | null;
  readonly x: number | null;
  readonly y: number | null;
  readonly tooltipLeft: string;
  readonly handleMove: (event: MouseEvent) => void;
  readonly clear: () => void;
  readonly setSvgElement: (element: SVGSVGElement | null) => void;
};

export const useSparklineHover = (points: readonly SeriesPoint[]): SparklineHover => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const bounds = useMemo(() => seriesBounds(points), [points]);
  const point = hoverIdx !== null ? (points[hoverIdx] ?? null) : null;
  const x = point ? projectX(point.ts, bounds) : null;
  const y = point ? projectY(point.value, bounds) : null;

  return {
    point,
    x,
    y,
    tooltipLeft: x !== null ? tooltipLeftForX(x) : '50%',
    handleMove: (event) => {
      updateHover(svgRef.current, event, points, bounds, setHoverIdx);
    },
    clear: () => {
      setHoverIdx(null);
    },
    setSvgElement: (element) => {
      svgRef.current = element;
    },
  };
};

const updateHover = (
  svg: SVGSVGElement | null,
  event: MouseEvent,
  points: readonly SeriesPoint[],
  bounds: ReturnType<typeof seriesBounds>,
  setHoverIdx: (index: number) => void,
) => {
  if (!svg) return;
  setHoverIdx(nearestPointIndex(points, targetXForMouse(svg, event), bounds));
};

const targetXForMouse = (svg: SVGSVGElement, event: MouseEvent): number => {
  const rect = svg.getBoundingClientRect();
  const ratio = (event.clientX - rect.left) / Math.max(1, rect.width);
  return SPARKLINE_PAD + ratio * (SPARKLINE_WIDTH - SPARKLINE_PAD * 2);
};
