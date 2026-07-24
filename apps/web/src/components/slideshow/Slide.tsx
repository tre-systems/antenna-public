import type { ApiSignal } from '../../api';
import { signalSourceLabel, signalTitle } from '../../signalFormat';
import { SignalCard } from '../SignalCard';

type SlideProps = {
  readonly signal: ApiSignal;
};

export function Slide({ signal }: SlideProps) {
  const title = signalTitle(signal);
  const source = signalSourceLabel(signal);

  return (
    <div
      key={signal.id}
      class="slideshow-slide flex w-full max-w-6xl flex-col items-center text-center"
      data-testid={`slideshow-slide-${signal.id}`}
    >
      <p class="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400 sm:text-base">
        {source}
      </p>
      <h2 class="mt-3 max-w-5xl text-center text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
        {title}
      </h2>
      {/* Body-only card: the signature hero without the metadata grid or footer,
          so the slide stays glanceable. The slide owns the larger title. */}
      <div class="mt-10 w-full max-w-5xl">
        <SignalCard signal={signal} readOnly bodyOnly />
      </div>
    </div>
  );
}
