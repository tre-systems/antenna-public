import type { ApiSignal } from '../../api';
import { Slide } from './Slide';

type SlideshowStageProps = {
  readonly signal: ApiSignal | null;
};

export function SlideshowStage({ signal }: SlideshowStageProps) {
  return (
    <div class="relative flex flex-1 items-center justify-center px-8">
      {signal ? <Slide signal={signal} /> : <SlideshowEmpty />}
    </div>
  );
}

function SlideshowEmpty() {
  return (
    <p class="text-lg italic text-slate-400" data-testid="slideshow-empty">
      No signals ready for slideshow yet — wait for live data, then try again.
    </p>
  );
}
