import { describe, expect, it } from 'vitest';
import { edgeScrollVelocity } from './auto-scroll';

describe('edgeScrollVelocity', () => {
  it('is zero away from the viewport edges', () => {
    expect(edgeScrollVelocity(400, 800)).toBe(0);
    expect(edgeScrollVelocity(72, 800)).toBe(0);
    expect(edgeScrollVelocity(800 - 72, 800)).toBe(0);
  });

  it('scrolls up faster the closer the pointer is to the top edge', () => {
    const near = edgeScrollVelocity(60, 800);
    const nearer = edgeScrollVelocity(10, 800);
    expect(near).toBeLessThan(0);
    expect(nearer).toBeLessThan(near);
  });

  it('scrolls down faster the closer the pointer is to the bottom edge', () => {
    const near = edgeScrollVelocity(750, 800);
    const nearer = edgeScrollVelocity(795, 800);
    expect(near).toBeGreaterThan(0);
    expect(nearer).toBeGreaterThan(near);
  });

  it('caps at full speed when the pointer leaves the viewport', () => {
    expect(edgeScrollVelocity(-40, 800)).toBe(edgeScrollVelocity(0, 800));
    expect(edgeScrollVelocity(840, 800)).toBe(edgeScrollVelocity(800, 800));
  });
});
