import type { ComponentChildren } from 'preact';
import { DWELL_MS } from './constants';

type SlideshowControlsProps = {
  readonly index: number;
  readonly total: number;
  readonly paused: boolean;
  readonly onPrev: () => void;
  readonly onNext: () => void;
  readonly onTogglePause: () => void;
};

export function SlideshowControls({
  index,
  total,
  paused,
  onPrev,
  onNext,
  onTogglePause,
}: SlideshowControlsProps) {
  if (total === 0) return null;

  return (
    <footer class="space-y-3 px-8 pb-6">
      <ProgressBar index={index} paused={paused} />
      <div class="flex items-center justify-between text-xs text-slate-300">
        <span>
          {index + 1} / {total}
        </span>
        <NavigationControls
          paused={paused}
          onPrev={onPrev}
          onNext={onNext}
          onTogglePause={onTogglePause}
        />
        <span class="text-slate-500">Space pauses · ← → navigate</span>
      </div>
    </footer>
  );
}

function ProgressBar({ index, paused }: { readonly index: number; readonly paused: boolean }) {
  return (
    <div class="h-0.5 w-full overflow-hidden bg-white/10">
      <div
        key={`${String(index)}-${String(paused)}`}
        class={
          paused ? 'h-full w-full bg-white/30' : 'slideshow-progress h-full w-full bg-emerald-400'
        }
        style={paused ? undefined : `animation-duration: ${String(DWELL_MS)}ms`}
      />
    </div>
  );
}

function NavigationControls({
  paused,
  onPrev,
  onNext,
  onTogglePause,
}: Omit<SlideshowControlsProps, 'index' | 'total'>) {
  return (
    <div class="flex items-center gap-2">
      <ControlButton onClick={onPrev} label="Previous slide" testid="slideshow-prev">
        ←
      </ControlButton>
      <ControlButton
        onClick={onTogglePause}
        label={paused ? 'Resume slideshow' : 'Pause slideshow'}
        testid="slideshow-pause"
      >
        {paused ? '▶' : '❚❚'}
      </ControlButton>
      <ControlButton onClick={onNext} label="Next slide" testid="slideshow-next">
        →
      </ControlButton>
    </div>
  );
}

function ControlButton({
  onClick,
  label,
  testid,
  children,
}: {
  readonly onClick: () => void;
  readonly label: string;
  readonly testid: string;
  readonly children: ComponentChildren;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      class="inline-flex h-8 w-8 items-center justify-center rounded-md bg-white/5 text-slate-200 transition-colors hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-sky-400/40"
      data-testid={testid}
    >
      {children}
    </button>
  );
}
