const EDGE_PX = 72;
const MAX_VELOCITY_PX_PER_FRAME = 22;

// Ramps linearly to full speed at the very edge. Negative scrolls up.
export function edgeScrollVelocity(clientY: number, viewportHeight: number): number {
  if (clientY < EDGE_PX) {
    return -MAX_VELOCITY_PX_PER_FRAME * (1 - Math.max(clientY, 0) / EDGE_PX);
  }
  const fromBottom = viewportHeight - clientY;
  if (fromBottom < EDGE_PX) {
    return MAX_VELOCITY_PX_PER_FRAME * (1 - Math.max(fromBottom, 0) / EDGE_PX);
  }
  return 0;
}

// onScroll re-runs the drag's hit-test, since cards move under a still pointer.
export function startEdgeAutoScroll(getPointerY: () => number, onScroll: () => void): () => void {
  let frame = requestAnimationFrame(function tick() {
    const velocity = edgeScrollVelocity(getPointerY(), window.innerHeight);
    if (velocity !== 0) {
      window.scrollBy(0, velocity);
      onScroll();
    }
    frame = requestAnimationFrame(tick);
  });
  return () => {
    cancelAnimationFrame(frame);
  };
}
