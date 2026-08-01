import type { ApiSignal } from '../api';
import { applyReorder, signals, draggingSignalId, reorderForDrop } from '../signals/signals';
import { cellFor, useGridDrag } from './collection-shell/use-grid-drag';
import { SignalCard } from './SignalCard';

type Props = { readonly signal: ApiSignal };

const gridSiblingIds = (cell: HTMLElement | null): string[] => {
  if (!cell?.parentElement) return [];
  return [...cell.parentElement.querySelectorAll<HTMLElement>('[data-signal-id]')]
    .map((el) => el.dataset.signalId)
    .filter((id): id is string => typeof id === 'string');
};

export function SignalGridItem({ signal }: Props) {
  const dragging = draggingSignalId.value === signal.id;
  const { onHandlePointerDown, onCardPointerDown } = useGridDrag(signal.id);

  const handleKeyDown = (event: KeyboardEvent) => {
    const delta =
      event.key === 'ArrowLeft' || event.key === 'ArrowUp'
        ? -1
        : event.key === 'ArrowRight' || event.key === 'ArrowDown'
          ? 1
          : 0;
    if (delta === 0) return;
    event.preventDefault();
    const current = signals.value;
    if (!current) return;
    const siblings = gridSiblingIds(cellFor(event.currentTarget as Element));
    const index = siblings.indexOf(signal.id);
    const neighborId = siblings[index + delta];
    if (index === -1 || !neighborId) return;
    const next = reorderForDrop(current, signal.id, neighborId);
    if (next !== current) void applyReorder(next);
  };

  return (
    <div
      class={`relative transition-[opacity,transform] duration-150 ${
        dragging ? 'scale-[0.98] opacity-40' : ''
      }`}
      onPointerDown={onCardPointerDown}
      data-testid={`signal-grid-item-${signal.id}`}
    >
      <button
        type="button"
        aria-label="Reorder signal: drag, or use arrow keys"
        title="Drag to reorder"
        onPointerDown={onHandlePointerDown}
        onKeyDown={handleKeyDown}
        // Touch handles reorder instead of scrolling and stay visible without hover.
        class="absolute left-1 top-1 z-[1] inline-flex h-6 w-6 cursor-grab touch-none items-center justify-center rounded-md text-slate-300 opacity-0 transition-opacity hover:text-slate-500 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 active:cursor-grabbing group-hover:opacity-100 dark:text-slate-600 dark:hover:text-slate-400 [@media(pointer:coarse)]:opacity-60"
        data-testid={`signal-drag-handle-${signal.id}`}
      >
        <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" class="h-3.5 w-3.5">
          <circle cx="5.5" cy="3.5" r="1.1" />
          <circle cx="10.5" cy="3.5" r="1.1" />
          <circle cx="5.5" cy="8" r="1.1" />
          <circle cx="10.5" cy="8" r="1.1" />
          <circle cx="5.5" cy="12.5" r="1.1" />
          <circle cx="10.5" cy="12.5" r="1.1" />
        </svg>
      </button>
      <SignalCard signal={signal} />
    </div>
  );
}
