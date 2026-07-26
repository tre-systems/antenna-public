import { SPARKLINE_HEIGHT, SPARKLINE_PAD, SPARKLINE_WIDTH } from './types';
import type { SparklineHover } from './use-sparkline-hover';

type SparklineSvgProps = {
  readonly label: string;
  readonly spanLabel: string;
  readonly path: string;
  readonly hover: SparklineHover;
  readonly compact?: boolean;
};

export function SparklineSvg({
  label,
  spanLabel,
  path,
  hover,
  compact = false,
}: SparklineSvgProps) {
  return (
    <svg
      ref={hover.setSvgElement}
      class={`${compact ? 'h-10' : 'h-24'} w-full overflow-visible text-emerald-600 dark:text-emerald-300`}
      viewBox={`0 0 ${SPARKLINE_WIDTH} ${SPARKLINE_HEIGHT}`}
      role="img"
      aria-label={`${label} ${spanLabel} chart`}
      preserveAspectRatio="none"
      onMouseMove={hover.handleMove}
      onMouseLeave={hover.clear}
      data-testid="sparkline-svg"
    >
      <SparklinePath path={path} />
      {hover.x !== null && hover.y !== null ? (
        <SparklineHoverMarker x={hover.x} y={hover.y} />
      ) : null}
    </svg>
  );
}

function SparklinePath({ path }: { readonly path: string }) {
  return (
    <path
      d={path}
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      vector-effect="non-scaling-stroke"
    />
  );
}

function SparklineHoverMarker({ x, y }: { readonly x: number; readonly y: number }) {
  return (
    <>
      <line
        x1={x}
        x2={x}
        y1={SPARKLINE_PAD}
        y2={SPARKLINE_HEIGHT - SPARKLINE_PAD}
        stroke="currentColor"
        stroke-width="1"
        stroke-dasharray="2,3"
        stroke-opacity="0.4"
        vector-effect="non-scaling-stroke"
      />
      <circle
        cx={x}
        cy={y}
        r={3}
        fill="currentColor"
        stroke="white"
        stroke-width="1.5"
        vector-effect="non-scaling-stroke"
      />
    </>
  );
}
