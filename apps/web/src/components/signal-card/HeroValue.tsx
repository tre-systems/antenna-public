import type { DataPoint } from '../../api';
import { pointValueText } from '../../signalFormat';

type HeroValueProps = {
  readonly point: DataPoint;
  readonly presentation?: boolean;
};

export function HeroValue({ point, presentation = false }: HeroValueProps) {
  const text = pointValueText(point);
  const isString =
    typeof point.value_text === 'string' ||
    (point.value !== null && typeof point.value === 'string');

  if (isString) {
    return (
      <p
        class={
          presentation
            ? 'text-4xl font-semibold leading-tight tracking-tight text-slate-950 sm:text-5xl dark:text-white'
            : 'mt-5 text-base font-medium text-slate-900 dark:text-slate-100'
        }
      >
        {text}
      </p>
    );
  }
  return (
    <div
      class={
        presentation ? 'flex flex-wrap items-end gap-x-4 gap-y-2' : 'mt-5 flex items-baseline gap-2'
      }
    >
      <span class={valueClass(presentation)}>{text}</span>
      {point.unit ? <span class={unitClass(presentation)}>{point.unit}</span> : null}
    </div>
  );
}

function valueClass(presentation: boolean): string {
  return presentation
    ? 'text-6xl font-semibold leading-none tracking-tight tabular-nums text-slate-950 sm:text-7xl lg:text-8xl dark:text-white'
    : 'text-3xl font-semibold tracking-tight tabular-nums text-slate-900 dark:text-white';
}

function unitClass(presentation: boolean): string {
  return presentation
    ? 'pb-2 text-2xl font-medium uppercase tracking-wide text-slate-500 sm:text-3xl dark:text-slate-300'
    : 'text-sm text-slate-500 dark:text-slate-400';
}
