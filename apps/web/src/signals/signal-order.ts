import type { ApiSignal } from '../api';

// Splice-move rather than insert-before-target, so dragging onto the next neighbour swaps them.
export function reorderForDrop(
  current: readonly ApiSignal[],
  draggedId: string,
  targetId: string,
): readonly ApiSignal[] {
  if (draggedId === targetId) return current;
  const from = current.findIndex((b) => b.id === draggedId);
  const to = current.findIndex((b) => b.id === targetId);
  if (from === -1 || to === -1) return current;
  const next = [...current];
  const [dragged] = next.splice(from, 1);
  if (!dragged) return current;
  next.splice(to, 0, dragged);
  return next;
}
