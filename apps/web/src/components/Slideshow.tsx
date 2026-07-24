import { useMemo, useRef } from 'preact/hooks';
import type { ApiSignal } from '../api';
import { isEligible } from './slideshow/eligibility';
import { SlideshowChrome } from './slideshow/SlideshowChrome';
import { SlideshowControls } from './slideshow/SlideshowControls';
import { SlideshowStage } from './slideshow/SlideshowStage';
import { useCloseOnFullscreenExit, useFullscreenOnMount } from './slideshow/use-fullscreen';
import { useSlideshowKeyboard } from './slideshow/use-keyboard-controls';
import { useSlideshowPlayback } from './slideshow/use-slideshow-playback';
import { usePointerIdle } from './slideshow/use-pointer-idle';

type Props = {
  readonly signals: readonly ApiSignal[];
  readonly onClose: () => void;
};

export function Slideshow({ signals, onClose }: Props) {
  const eligible = useMemo(() => signals.filter(isEligible), [signals]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { pointerIdle, markActive } = usePointerIdle();
  const playback = useSlideshowPlayback(eligible.length);
  const current = eligible[playback.safeIndex] ?? null;

  useFullscreenOnMount(containerRef);
  useCloseOnFullscreenExit(onClose);
  useSlideshowKeyboard({
    onActivity: markActive,
    onClose,
    onNext: playback.goNext,
    onPrev: playback.goPrev,
    onTogglePause: playback.togglePause,
  });

  return (
    <div
      ref={containerRef}
      class={`fixed inset-0 z-50 flex flex-col bg-slate-950 text-white ${
        pointerIdle ? 'cursor-none' : ''
      }`}
      onMouseMove={markActive}
      onMouseDown={markActive}
      onTouchStart={markActive}
      data-testid="slideshow"
      data-pointer-idle={pointerIdle ? 'true' : 'false'}
    >
      <div
        class={`transition-opacity duration-500 ${
          pointerIdle ? 'pointer-events-none opacity-0' : 'opacity-100'
        }`}
        data-testid="slideshow-chrome-wrapper"
      >
        <SlideshowChrome eligible={eligible.length} total={signals.length} onClose={onClose} />
      </div>

      <SlideshowStage signal={current} />

      <div
        class={`transition-opacity duration-500 ${
          pointerIdle ? 'pointer-events-none opacity-0' : 'opacity-100'
        }`}
        data-testid="slideshow-controls-wrapper"
      >
        <SlideshowControls
          index={playback.safeIndex}
          total={eligible.length}
          paused={playback.paused}
          onPrev={playback.goPrev}
          onNext={playback.goNext}
          onTogglePause={playback.togglePause}
        />
      </div>
    </div>
  );
}
