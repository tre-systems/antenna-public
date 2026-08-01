import { prefersReducedMotion } from './flip';

// Ignore the floating card so hit tests reach the grid beneath it.
export type DragGhost = {
  readonly moveTo: (dx: number, dy: number) => void;
  readonly settleInto: (target: DOMRect) => void;
  readonly remove: () => void;
};

export function createDragGhost(cell: HTMLElement): DragGhost {
  const origin = cell.getBoundingClientRect();
  const ghost = cell.cloneNode(true) as HTMLElement;
  delete ghost.dataset.signalId;
  styleGhost(ghost, origin);
  document.body.appendChild(ghost);

  let lastTransform = liftTransform(0, 0);
  const moveTo = (dx: number, dy: number): void => {
    lastTransform = liftTransform(dx, dy);
    ghost.style.transform = lastTransform;
  };

  const remove = (): void => {
    ghost.remove();
  };

  const settleInto = (target: DOMRect): void => {
    if (prefersReducedMotion() || typeof ghost.animate !== 'function') {
      remove();
      return;
    }
    const landing = `translate(${String(target.left - origin.left)}px, ${String(target.top - origin.top)}px)`;
    const settle = ghost.animate(
      [
        { transform: lastTransform, filter: LIFT_SHADOW },
        { transform: landing, filter: LANDED_SHADOW },
      ],
      { duration: 160, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)', fill: 'forwards' },
    );
    settle.onfinish = settle.oncancel = remove;
  };

  return { moveTo, settleInto, remove };
}

const liftTransform = (dx: number, dy: number): string =>
  `translate(${String(dx)}px, ${String(dy)}px) scale(1.02)`;

const LIFT_SHADOW = 'drop-shadow(0 18px 32px rgba(15, 23, 42, 0.28))';
const LANDED_SHADOW = 'drop-shadow(0 0 0 rgba(15, 23, 42, 0))';

function styleGhost(ghost: HTMLElement, origin: DOMRect): void {
  Object.assign(ghost.style, {
    position: 'fixed',
    left: `${String(origin.left)}px`,
    top: `${String(origin.top)}px`,
    width: `${String(origin.width)}px`,
    height: `${String(origin.height)}px`,
    margin: '0',
    zIndex: '40',
    pointerEvents: 'none',
    transform: liftTransform(0, 0),
    filter: LIFT_SHADOW,
    willChange: 'transform',
  });
}
