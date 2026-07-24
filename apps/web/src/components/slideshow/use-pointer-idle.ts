import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { IDLE_MS } from './constants';

type IdleTimerRef = {
  current: ReturnType<typeof setTimeout> | null;
};

export function usePointerIdle(): {
  readonly pointerIdle: boolean;
  readonly markActive: () => void;
} {
  const [pointerIdle, setPointerIdle] = useState(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimer = useCallback(() => {
    clearIdleTimer(idleTimerRef);
  }, []);

  const markActive = useCallback(() => {
    setPointerIdle(false);
    clearTimer();
    idleTimerRef.current = setTimeout(() => {
      setPointerIdle(true);
    }, IDLE_MS);
  }, [clearTimer]);

  useEffect(() => {
    markActive();
    return clearTimer;
  }, [clearTimer, markActive]);

  return { pointerIdle, markActive };
}

const clearIdleTimer = (idleTimerRef: IdleTimerRef): void => {
  if (idleTimerRef.current === null) return;
  clearTimeout(idleTimerRef.current);
  idleTimerRef.current = null;
};
