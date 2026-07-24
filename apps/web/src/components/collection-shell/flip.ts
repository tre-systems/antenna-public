import { useLayoutEffect, useRef } from 'preact/hooks';

type CellRects = Map<string, { left: number; top: number }>;

export const prefersReducedMotion = (): boolean =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// First-Last-Invert-Play over the grid cells: after every render, each cell
// that changed position slides from where it last was to where it now is.
// Positions are container-relative so page scrolling between renders does not
// read as movement. Newly added cells have no previous position and are left
// to the `signal-enter` CSS animation; removed cells simply vanish while the
// survivors glide into the gap.
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

// Reordering moves the cell's DOM node, and re-inserting a node restarts the
// card's one-shot `signal-enter` CSS intro (a delayed 6px hop) — which reads
// as a flash layered on top of the slide. Jump any replay straight to its
// end state before animating the move. Runs in useLayoutEffect, so the
// restarted frame is never painted.
function stopEnterReplay(cell: HTMLElement): void {
  if (typeof cell.getAnimations !== 'function') return;
  for (const animation of cell.getAnimations({ subtree: true })) {
    if ('animationName' in animation && animation.animationName === 'signal-enter') {
      animation.finish();
    }
  }
}
