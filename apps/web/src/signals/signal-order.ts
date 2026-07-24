import type { ApiSignal } from '../api';

// Move the dragged signal to the target's current position (splice-move).
// Unlike insert-before-target semantics, this makes dragging onto the next
// neighbour swap the two cards instead of being a no-op.
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
