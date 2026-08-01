import { describe, expect, it, vi } from 'vitest';
import { connectCollectionStream } from './collection-stream';

type Listener = (event: unknown) => void;

class FakeEventSource {
  closed = false;
  readonly listeners = new Map<string, Listener[]>();
  constructor(public readonly url: string) {}
  addEventListener(type: string, listener: Listener): void {
    const arr = this.listeners.get(type) ?? [];
    arr.push(listener);
    this.listeners.set(type, arr);
  }
  close(): void {
    this.closed = true;
  }
  dispatch(type: string, event: unknown = {}): void {
    for (const l of this.listeners.get(type) ?? []) l(event);
  }
}

type FakeTimer = { readonly handler: () => void; readonly ms: number };

const makeFakeTimers = () => {
  const timers = new Map<number, FakeTimer>();
  let nextId = 1;
  const setIntervalFn = ((handler: () => void, ms?: number) => {
    const id = nextId;
    nextId += 1;
    timers.set(id, { handler, ms: ms ?? 0 });
    return id as unknown as ReturnType<typeof setInterval>;
  }) as typeof globalThis.setInterval;
  const clearIntervalFn = ((id: ReturnType<typeof setInterval>) => {
    timers.delete(id as unknown as number);
  }) as typeof globalThis.clearInterval;
  return { timers, setIntervalFn, clearIntervalFn };
};

const firstTimer = (timers: Map<number, FakeTimer>): FakeTimer => {
  const t = [...timers.values()][0];
  if (!t) throw new Error('expected at least one timer');
  return t;
};

type SourceHolder = { current: FakeEventSource | null };
const captureSource = (holder: SourceHolder) => (url: string) => {
  holder.current = new FakeEventSource(url);
  return holder.current as unknown as EventSource;
};
const requireSource = (holder: SourceHolder): FakeEventSource => {
  if (!holder.current) throw new Error('EventSource was not created');
  return holder.current;
};

describe('connectCollectionStream', () => {
  it('invokes onEvent on each SSE message', () => {
    const onEvent = vi.fn();
    const holder: SourceHolder = { current: null };
    const conn = connectCollectionStream('/api/stream', {
      onEvent,
      createEventSource: captureSource(holder),
      ...makeFakeTimers(),
    });
    const source = requireSource(holder);
    source.dispatch('message', { data: '{}' });
    source.dispatch('message', { data: '{}' });
    expect(onEvent).toHaveBeenCalledTimes(2);
    conn.close();
    expect(source.closed).toBe(true);
  });

  it('falls back to polling when EventSource is unavailable', () => {
    const onEvent = vi.fn();
    const { setIntervalFn, clearIntervalFn, timers } = makeFakeTimers();
    const conn = connectCollectionStream('/api/stream', {
      onEvent,
      createEventSource: () => null,
      setIntervalFn,
      clearIntervalFn,
    });
    expect(timers.size).toBe(1);
    firstTimer(timers).handler();
    expect(onEvent).toHaveBeenCalledTimes(1);
    conn.close();
    expect(timers.size).toBe(0);
  });

  it('starts the poller after three consecutive errors and stops it on open', () => {
    const onEvent = vi.fn();
    const { setIntervalFn, clearIntervalFn, timers } = makeFakeTimers();
    const holder: SourceHolder = { current: null };
    connectCollectionStream('/api/stream', {
      onEvent,
      createEventSource: captureSource(holder),
      setIntervalFn,
      clearIntervalFn,
    });
    const source = requireSource(holder);
    // Only the staleness check is running.
    expect(timers.size).toBe(1);
    source.dispatch('error');
    source.dispatch('error');
    expect(timers.size).toBe(1);
    source.dispatch('error');
    // Fallback poller now running alongside the staleness check.
    expect(timers.size).toBe(2);
    source.dispatch('open');
    expect(timers.size).toBe(1);
  });

  it('forces a refetch when the stream goes idle longer than the staleness window', () => {
    const onEvent = vi.fn();
    const { setIntervalFn, clearIntervalFn, timers } = makeFakeTimers();
    let nowValue = 1_000;
    const holder: SourceHolder = { current: null };
    connectCollectionStream('/api/stream', {
      onEvent,
      now: () => nowValue,
      createEventSource: captureSource(holder),
      setIntervalFn,
      clearIntervalFn,
    });
    requireSource(holder);
    const stalenessTimer = firstTimer(timers);
    nowValue = 1_000 + 30_000;
    stalenessTimer.handler();
    expect(onEvent).not.toHaveBeenCalled();
    nowValue = 1_000 + 90_000;
    stalenessTimer.handler();
    expect(onEvent).toHaveBeenCalledTimes(1);
  });
});
