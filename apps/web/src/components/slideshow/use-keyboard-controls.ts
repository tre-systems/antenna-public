import { useEffect } from 'preact/hooks';

type KeyboardControls = {
  readonly onActivity: () => void;
  readonly onClose: () => void;
  readonly onPrev: () => void;
  readonly onNext: () => void;
  readonly onTogglePause: () => void;
};

export function useSlideshowKeyboard({
  onActivity,
  onClose,
  onPrev,
  onNext,
  onTogglePause,
}: KeyboardControls): void {
  useEffect(() => {
    const controls = { onActivity, onClose, onPrev, onNext, onTogglePause };
    const onKey = (event: KeyboardEvent) => {
      handleSlideshowKey(event, controls);
    };

    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [onActivity, onClose, onNext, onPrev, onTogglePause]);
}

function handleSlideshowKey(event: KeyboardEvent, controls: KeyboardControls): void {
  controls.onActivity();

  if (event.key === 'Escape') {
    controls.onClose();
  } else if (event.key === ' ') {
    event.preventDefault();
    controls.onTogglePause();
  } else if (event.key === 'ArrowRight') {
    controls.onNext();
  } else if (event.key === 'ArrowLeft') {
    controls.onPrev();
  }
}
