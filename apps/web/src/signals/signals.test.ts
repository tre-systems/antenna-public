import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  displayedSignals,
  loadSignals,
  pendingRemoval,
  signals,
  startRemoval,
  undoRemoval,
  UNDO_WINDOW_MS,
} from './signals';
import { jsonResponse, mockFetch, resetSignalState, sampleSignal, urlOf } from './test-support';

beforeEach(() => {
  vi.useFakeTimers();
  resetSignalState();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  resetSignalState();
});

describe('signal removal', () => {
  it('hides a signal in the undo window from displayedSignals but keeps it in signals', () => {
    signals.value = [sampleSignal('a'), sampleSignal('b')];
    startRemoval(sampleSignal('a'));

    expect(signals.value).toHaveLength(2);
    expect(displayedSignals.value).toHaveLength(1);
    expect(displayedSignals.value?.[0]?.id).toBe('b');
  });

  it('undoRemoval restores the signal to displayedSignals without calling DELETE', () => {
    const fetchSpy = vi.fn();
    mockFetch(fetchSpy);
    signals.value = [sampleSignal('a'), sampleSignal('b')];
    startRemoval(sampleSignal('a'));

    undoRemoval();

    expect(displayedSignals.value).toHaveLength(2);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('commits the delete after the undo window elapses and refetches', async () => {
    const calls: string[] = [];
    mockFetch((input) => {
      const url = urlOf(input);
      calls.push(url);
      if (url.endsWith('/api/signals/a')) return jsonResponse({ deleted: true });
      return jsonResponse([sampleSignal('b')]);
    });

    signals.value = [sampleSignal('a'), sampleSignal('b')];
    startRemoval(sampleSignal('a'));

    vi.advanceTimersByTime(UNDO_WINDOW_MS);
    await vi.runAllTimersAsync();

    expect(calls.some((c) => c.endsWith('/api/signals/a'))).toBe(true);
    expect(calls.some((c) => c.endsWith('/api/signals'))).toBe(true);
    expect(signals.value).toEqual([sampleSignal('b')]);
    expect(pendingRemoval.value).toBeNull();
  });

  it('starting a second removal commits the first one immediately so only one toast is in flight', () => {
    const deleted: string[] = [];
    mockFetch((input) => {
      const match = /\/api\/signals\/([^/?]+)$/.exec(urlOf(input));
      if (match && match[1] && match[1] !== 'signals') {
        deleted.push(match[1]);
        return jsonResponse({ deleted: true });
      }
      return jsonResponse([]);
    });
    signals.value = [sampleSignal('a'), sampleSignal('b')];

    startRemoval(sampleSignal('a'));
    startRemoval(sampleSignal('b'));

    const pending = pendingRemoval.value;
    expect(pending).not.toBeNull();
    expect(pending && pending.signal.id).toBe('b');
    expect(deleted).toEqual(['a']);
  });

  it('keeps the removed card hidden between undo-window expiry and delete completion', async () => {
    // Regression: the card flashed back when pendingRemoval cleared before the DELETE finished.
    let resolveDelete: ((res: Response) => void) | undefined;
    mockFetch((input) => {
      if (urlOf(input).endsWith('/api/signals/a')) {
        return new Promise<Response>((resolve) => {
          resolveDelete = resolve;
        });
      }
      return jsonResponse([sampleSignal('b')]);
    });

    signals.value = [sampleSignal('a'), sampleSignal('b')];
    startRemoval(sampleSignal('a'));

    vi.advanceTimersByTime(UNDO_WINDOW_MS);
    await Promise.resolve();

    expect(pendingRemoval.value).toBeNull();
    expect(signals.value.map((s) => s.id)).toContain('a');
    expect(displayedSignals.value?.map((s) => s.id)).toEqual(['b']);

    // An SSE-style refetch landing mid-delete must not resurrect the card.
    await loadSignals();
    expect(displayedSignals.value?.map((s) => s.id)).toEqual(['b']);

    resolveDelete?.(jsonResponse({ deleted: true }));
    await vi.runAllTimersAsync();
    expect(displayedSignals.value?.map((s) => s.id)).toEqual(['b']);
  });
});
