import { useCallback, useEffect, useState } from 'preact/hooks';
import { DWELL_MS } from './constants';
import { safeIndexFor } from './eligibility';

type IndexUpdater = (update: (previous: number) => number) => void;

type SlideshowPlayback = {
  readonly safeIndex: number;
  readonly paused: boolean;
  readonly goPrev: () => void;
  readonly goNext: () => void;
  readonly togglePause: () => void;
};

export function useSlideshowPlayback(total: number): SlideshowPlayback {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const safeIndex = safeIndexFor(index, total);

  const goPrev = useCallback(() => {
    if (total > 0) setIndex((current) => previousIndex(current, total));
  }, [total]);

  const goNext = useCallback(() => {
    if (total > 0) setIndex((current) => nextIndex(current, total));
  }, [total]);

  const togglePause = useCallback(() => {
    setPaused((current) => !current);
  }, []);

  useAutoAdvance({ activeIndex: index, paused, setIndex, total });

  return { safeIndex, paused, goPrev, goNext, togglePause };
}

function useAutoAdvance({
  activeIndex,
  paused,
  setIndex,
  total,
}: {
  readonly activeIndex: number;
  readonly paused: boolean;
  readonly setIndex: IndexUpdater;
  readonly total: number;
}): void {
  useEffect(() => {
    if (paused || total <= 1) return;
    const id = setTimeout(() => {
      setIndex((current) => nextIndex(current, total));
    }, DWELL_MS);
    return () => {
      clearTimeout(id);
    };
  }, [activeIndex, paused, setIndex, total]);
}

const nextIndex = (index: number, total: number): number => {
  return (index + 1) % total;
};

const previousIndex = (index: number, total: number): number => {
  return (index - 1 + total) % total;
};
