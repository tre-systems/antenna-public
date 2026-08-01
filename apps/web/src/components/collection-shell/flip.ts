import { useLayoutEffect, useRef } from 'preact/hooks';

type CellRects = Map<string, { left: number; top: number }>;

export const prefersReducedMotion = (): boolean =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// Container-relative FLIP positions ignore page scrolling between renders.
export function useGridFlip(containerRef: { readonly current: HTMLElement | null }): void {
  const previous = useRef<CellRects>(new Map());
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const origin = container.getBoundingClientRect();
    const next: CellRects = new Map();
    for (const cell of container.querySelectorAll<HTMLElement>('[data-signal-id]')) {
      const id = cell.dataset.signalId;
      if (!id) continue;
      const rect = cell.getBoundingClientRect();
      const position = { left: rect.left - origin.left, top: rect.top - origin.top };
      next.set(id, position);
      playMove(cell, previous.current.get(id), position);
    }
    previous.current = next;
  });
}

function playMove(
  cell: HTMLElement,
  from: { left: number; top: number } | undefined,
  to: { left: number; top: number },
): void {
  if (!from || prefersReducedMotion() || typeof cell.animate !== 'function') return;
  const dx = from.left - to.left;
  const dy = from.top - to.top;
  if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
  stopEnterReplay(cell);
  cell.animate(
    [{ transform: `translate(${String(dx)}px, ${String(dy)}px)` }, { transform: 'none' }],
    { duration: 180, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' },
  );
}

// Finish the one-shot intro before re-insertion can restart it.
function stopEnterReplay(cell: HTMLElement): void {
  if (typeof cell.getAnimations !== 'function') return;
  for (const animation of cell.getAnimations({ subtree: true })) {
    if ('animationName' in animation && animation.animationName === 'signal-enter') {
      animation.finish();
    }
  }
}

// Cell-level animations are only the FLIP slides played above.
export const isSliding = (el: HTMLElement): boolean =>
  typeof el.getAnimations === 'function' && el.getAnimations().length > 0;

export const finishSlides = (el: HTMLElement): void => {
  if (typeof el.getAnimations !== 'function') return;
  for (const animation of el.getAnimations()) animation.finish();
};

export const finishAllSlides = (anyCell: HTMLElement): void => {
  const cells = anyCell.parentElement?.querySelectorAll<HTMLElement>('[data-signal-id]');
  if (cells) for (const gridCell of cells) finishSlides(gridCell);
};
