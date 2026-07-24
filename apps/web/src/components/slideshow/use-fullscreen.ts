import { useEffect } from 'preact/hooks';

type FullscreenRef = {
  readonly current: HTMLDivElement | null;
};

export function useFullscreenOnMount(containerRef: FullscreenRef): void {
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    requestFullscreen(el);
    return exitFullscreen;
  }, [containerRef]);
}

export function useCloseOnFullscreenExit(onClose: () => void): void {
  useEffect(() => {
    const onFullscreenChange = () => {
      if (typeof document !== 'undefined' && !document.fullscreenElement) onClose();
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
    };
  }, [onClose]);
}

const requestFullscreen = (element: HTMLDivElement): void => {
  if (typeof element.requestFullscreen !== 'function') return;
  void element.requestFullscreen().catch(() => {
    // The fixed overlay still covers the viewport if fullscreen is denied.
  });
};

const exitFullscreen = (): void => {
  if (typeof document === 'undefined' || !document.fullscreenElement) return;
  void document.exitFullscreen().catch(() => {
    /* already exiting */
  });
};
