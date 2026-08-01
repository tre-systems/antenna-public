// Drawn at 24×24 with currentColor strokes so the parent sizes and colours them.

import type { WeatherCondition } from '../signal-format';

type Props = {
  readonly condition: WeatherCondition;
  readonly className?: string;
  readonly title?: string;
};

const STROKE = {
  stroke: 'currentColor',
  'stroke-width': '1.5',
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
  fill: 'none',
} as const;

export function WeatherIcon({ condition, className, title }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      class={className ?? 'h-6 w-6'}
      role={title ? 'img' : 'presentation'}
      aria-label={title}
      data-condition={condition}
    >
      {renderCondition(condition)}
    </svg>
  );
}

function renderCondition(condition: WeatherCondition) {
  switch (condition) {
    case 'clear':
      return (
        <g>
          <circle cx="12" cy="12" r="4" fill="currentColor" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => {
            const rad = (angle * Math.PI) / 180;
            const x1 = 12 + Math.cos(rad) * 7;
            const y1 = 12 + Math.sin(rad) * 7;
            const x2 = 12 + Math.cos(rad) * 9.5;
            const y2 = 12 + Math.sin(rad) * 9.5;
            return <line key={angle} x1={x1} y1={y1} x2={x2} y2={y2} {...STROKE} />;
          })}
        </g>
      );
    case 'partly-cloudy':
      return (
        <g>
          <circle cx="9" cy="9" r="3" fill="currentColor" />
          <line x1="9" y1="3" x2="9" y2="5" {...STROKE} />
          <line x1="3" y1="9" x2="5" y2="9" {...STROKE} />
          <line x1="14" y1="5" x2="13" y2="6" {...STROKE} />
          <path
            d="M7 17 a4 3 0 0 1 4-3 a4 3 0 0 1 4 2 a3 2.5 0 0 1 3 2.5 a2.5 2 0 0 1-2 2 h-9 a3 3 0 0 1-1-3.5z"
            {...STROKE}
          />
        </g>
      );
    case 'cloudy':
      return (
        <g>
          <path
            d="M7 17 a4 3 0 0 1 4-3 a4 3 0 0 1 4 2 a3 2.5 0 0 1 3 2.5 a2.5 2 0 0 1-2 2 h-9 a3 3 0 0 1-1-3.5z"
            {...STROKE}
          />
          <path d="M5 13 a3 2.5 0 0 1 3-2.5 a3 2.5 0 0 1 3 2 a2 1.5 0 0 1 2 1.5" {...STROKE} />
        </g>
      );
    case 'fog':
      return (
        <g>
          <line x1="4" y1="9" x2="20" y2="9" {...STROKE} />
          <line x1="4" y1="13" x2="20" y2="13" {...STROKE} />
          <line x1="4" y1="17" x2="20" y2="17" {...STROKE} />
        </g>
      );
    case 'drizzle':
      return (
        <g>
          <path
            d="M5 14 a4 3 0 0 1 4-3 a4 3 0 0 1 4 2 a3 2.5 0 0 1 3 2.5 a2.5 2 0 0 1-2 2 h-9 a3 3 0 0 1-1-3.5z"
            {...STROKE}
          />
          <line x1="9" y1="18" x2="8" y2="20" {...STROKE} />
          <line x1="13" y1="18" x2="12" y2="20" {...STROKE} />
        </g>
      );
    case 'rain':
      return (
        <g>
          <path
            d="M5 13 a4 3 0 0 1 4-3 a4 3 0 0 1 4 2 a3 2.5 0 0 1 3 2.5 a2.5 2 0 0 1-2 2 h-9 a3 3 0 0 1-1-3.5z"
            {...STROKE}
          />
          <line x1="8" y1="17" x2="7" y2="21" {...STROKE} />
          <line x1="12" y1="17" x2="11" y2="21" {...STROKE} />
          <line x1="16" y1="17" x2="15" y2="21" {...STROKE} />
        </g>
      );
    case 'snow':
      return (
        <g>
          <path
            d="M5 13 a4 3 0 0 1 4-3 a4 3 0 0 1 4 2 a3 2.5 0 0 1 3 2.5 a2.5 2 0 0 1-2 2 h-9 a3 3 0 0 1-1-3.5z"
            {...STROKE}
          />
          <line x1="8" y1="18" x2="8" y2="21" {...STROKE} />
          <line x1="6.5" y1="19.5" x2="9.5" y2="19.5" {...STROKE} />
          <line x1="14" y1="18" x2="14" y2="21" {...STROKE} />
          <line x1="12.5" y1="19.5" x2="15.5" y2="19.5" {...STROKE} />
        </g>
      );
    case 'thunderstorm':
      return (
        <g>
          <path
            d="M5 12 a4 3 0 0 1 4-3 a4 3 0 0 1 4 2 a3 2.5 0 0 1 3 2.5 a2.5 2 0 0 1-2 2 h-9 a3 3 0 0 1-1-3.5z"
            {...STROKE}
          />
          <path
            d="M11 15 l-2 4 h3 l-1 4 l3-5 h-2 l1-3"
            stroke="currentColor"
            stroke-width="1.2"
            fill="currentColor"
          />
        </g>
      );
  }
}
