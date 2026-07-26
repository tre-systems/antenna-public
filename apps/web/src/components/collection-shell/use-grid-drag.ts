import { useEffect, useRef } from 'preact/hooks';
import type { ApiSignal } from '../../api';
import { applyReorder, draggingSignalId, reorderForDrop, signals } from '../../signals/signals';
import { startEdgeAutoScroll } from './auto-scroll';
import { createDragGhost, type DragGhost } from './drag-ghost';
import { finishAllSlides, finishSlides, isSliding } from './flip';

// Pointer drag for grid cards: a ghost tracks the pointer while the grid
// live-previews the drop order.
// The card surface takes mouse drags only — a whole-card touch drag would fight
// page scrolling — so touch reorders must start on the grip handle.
// Listeners live on window, not setPointerCapture: the live preview re-parents
// cells, and moving a node silently releases capture.

const DRAG_THRESHOLD_PX = 6;

export const cellFor = (element: Element | null): HTMLElement | null =>
  element?.closest<HTMLElement>('[data-signal-id]') ?? null;

const INTERACTIVE_SELECTOR = 'a, button, input, select, textarea, [role="button"], [role="menu"]';

const isInteractive = (target: EventTarget | null): boolean =>
  target instanceof Element && target.closest(INTERACTIVE_SELECTOR) !== null;

type GridDragHandlers = {
  readonly onHandlePointerDown: (down: PointerEvent) => void;
  readonly onCardPointerDown: (down: PointerEvent) => void;
};

export function useGridDrag(signalId: string): GridDragHandlers {
  const cleanupRef = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanupRef.current?.(), []);

  const arm = (down: PointerEvent): void => {
    const cell = cellFor(down.currentTarget as Element);
    const initialOrder = signals.value;
    if (!cell || !initialOrder) return;
    cleanupRef.current?.();
    cleanupRef.current = armDrag({
      down,
      cell,
      signalId,
      initialOrder,
      onDone: () => (cleanupRef.current = null),
    });
  };

  return {
    onHandlePointerDown: (down) => {
      if (down.pointerType === 'mouse' && down.button !== 0) return;
      down.preventDefault();
      arm(down);
    },
    onCardPointerDown: (down) => {
      if (down.pointerType !== 'mouse' || down.button !== 0) return;
      if (isInteractive(down.target)) return;
      arm(down);
    },
  };
}

type DragArgs = {
  readonly down: PointerEvent;
  readonly cell: HTMLElement;
  readonly signalId: string;
  readonly initialOrder: readonly ApiSignal[];
  readonly onDone: () => void;
};

function armDrag({ down, cell, signalId, initialOrder, onDone }: DragArgs): () => void {
  let ghost: DragGhost | null = null;
  let stopAutoScroll: (() => void) | null = null;
  let pointer = { x: down.clientX, y: down.clientY };
  let reflowPending = false;

  // Hit-testing a mid-slide card reads a moving position and thrashes the grid,
  // so wait for settled layout — except on drop, which snaps first so a fast
  // flick still lands on the slot under the pointer.
  const previewAtPointer = (isDrop = false): void => {
    if (reflowPending) return;
    if (isDrop) finishAllSlides(cell);
    const overCell = cellFor(document.elementFromPoint(pointer.x, pointer.y));
    const targetId = overCell?.dataset.signalId;
    const current = signals.value;
    if (!overCell || !targetId || targetId === signalId || !current) return;
    if (!isDrop && (isSliding(overCell) || isSliding(cell))) return;
    const next = reorderForDrop(current, signalId, targetId);
    if (next === current) return;
    signals.value = [...next];
    reflowPending = true;
    requestAnimationFrame(() => (reflowPending = false));
  };

  const activate = (): void => {
    draggingSignalId.value = signalId;
    ghost = createDragGhost(cell);
    document.body.style.userSelect = 'none';
    window.getSelection()?.removeAllRanges();
    stopAutoScroll = startEdgeAutoScroll(() => pointer.y, previewAtPointer);
  };

  const onMove = (move: PointerEvent): void => {
    if (move.pointerId !== down.pointerId) return;
    pointer = { x: move.clientX, y: move.clientY };
    if (!ghost) {
      const distance = Math.hypot(move.clientX - down.clientX, move.clientY - down.clientY);
      if (distance < DRAG_THRESHOLD_PX) return;
      activate();
    }
    ghost?.moveTo(move.clientX - down.clientX, move.clientY - down.clientY);
    previewAtPointer();
  };

  const finish = (commit: boolean): void => {
    removeListeners();
    onDone();
    if (!ghost) return;
    stopAutoScroll?.();
    document.body.style.userSelect = '';
    suppressNextClick();
    settleDrop(commit, ghost);
  };

  const settleDrop = (commit: boolean, activeGhost: DragGhost): void => {
    if (commit) previewAtPointer(true);
    const current = signals.value ?? initialOrder;
    const changed = orderChanged(current, initialOrder);
    if (commit && changed) void applyReorder(current, initialOrder);
    if (!commit && changed) signals.value = [...initialOrder];
    // Un-dim while the ghost still covers the card, so there is no opacity pop.
    draggingSignalId.value = null;
    if (!commit) {
      activeGhost.remove();
      return;
    }
    // Land a frame later on the settled rect; a stale or mid-slide target snaps.
    requestAnimationFrame(() => {
      finishSlides(cell);
      activeGhost.settleInto(cell.getBoundingClientRect());
    });
  };

  const onUp = (up: PointerEvent): void => {
    if (up.pointerId === down.pointerId) finish(true);
  };
  const onCancel = (cancel: PointerEvent): void => {
    if (cancel.pointerId === down.pointerId) finish(false);
  };
  const onKeyDown = (key: KeyboardEvent): void => {
    if (key.key === 'Escape') finish(false);
  };

  const removeListeners = (): void => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onCancel);
    window.removeEventListener('keydown', onKeyDown);
  };

  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onCancel);
  window.addEventListener('keydown', onKeyDown);

  // Teardown for unmount or a new drag arming: abandon without committing.
  return () => {
    removeListeners();
    stopAutoScroll?.();
    document.body.style.userSelect = '';
    ghost?.remove();
    if (draggingSignalId.value === signalId) draggingSignalId.value = null;
  };
}

const orderChanged = (a: readonly ApiSignal[], b: readonly ApiSignal[]): boolean =>
  a.length !== b.length || a.some((item, index) => item.id !== b[index]?.id);

// A drop over the card would otherwise land as a click and toggle the card's
// compact/expanded state. Swallow the one click that follows a real drag.
function suppressNextClick(): void {
  const squelch = (event: MouseEvent): void => {
    event.stopPropagation();
    event.preventDefault();
  };
  window.addEventListener('click', squelch, { capture: true, once: true });
  setTimeout(() => {
    window.removeEventListener('click', squelch, { capture: true });
  }, 0);
}
