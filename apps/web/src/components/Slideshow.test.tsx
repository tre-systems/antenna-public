// Render-only tests. Auto-advance, fullscreen request, and keyboard
// controls need a real DOM and are exercised in e2e + manual smoke.
import { describe, expect, it } from 'vitest';
import renderToString from 'preact-render-to-string';
import { Slideshow } from './Slideshow';
import type { ApiSignal } from '../api';

const NOW = Date.now();

const liveSignal = (id: string, overrides: Partial<ApiSignal> = {}): ApiSignal => ({
  id,
  template_id: 'fx-pair',
  visibility: 'private',
  config: { base: 'EUR', quote: 'USD' },
  refresh_seconds: 900,
  status: {
    status: 'live',
    last_ok_at: NOW - 10_000,
    last_attempt_at: NOW - 10_000,
    last_error: null,
    last_manual_request_at: null,
  },
  points: [{ dimensions: { pair: 'EUR/USD' }, value: 1.0876, ts: NOW - 10_000 }],
  ...overrides,
});

describe('Slideshow', () => {
  it('renders the chrome, slide, and controls when signals are eligible', () => {
    const html = renderToString(
      <Slideshow signals={[liveSignal('a'), liveSignal('b')]} onClose={() => {}} />,
    );
    expect(html).toContain('data-testid="slideshow"');
    expect(html).toContain('data-testid="slideshow-close"');
    expect(html).toContain('data-testid="slideshow-slide-a"');
    expect(html).toContain('data-testid="slideshow-prev"');
    expect(html).toContain('data-testid="slideshow-next"');
    expect(html).toContain('data-testid="slideshow-pause"');
    expect(html).toContain('1 / 2');
    expect(html).toContain('presenting 2 of 2');
  });

  it('renders the slide title once — the embedded signal header must be suppressed', () => {
    // Regression: the slide rendered its own large centred title AND the
    // SignalCard's own header, so every presentation slide showed two
    // overlapping copies of the title (and a duplicate source label).
    const html = renderToString(
      <Slideshow
        signals={[liveSignal('eur', { config: { base: 'EUR', quote: 'USD' } })]}
        onClose={() => {}}
      />,
    );
    const matches = html.match(/EUR\/USD/g);
    expect(matches?.length ?? 0).toBe(1);
  });

  it('strips the operator metadata grid and freshness line from each slide', () => {
    // Radiator regression: slides reused the expanded card, which mounted the
    // Source/Last updated/Status/Refresh/Visibility detail grid — duplicating
    // the source eyebrow and cluttering an across-the-room screen.
    const html = renderToString(<Slideshow signals={[liveSignal('a')]} onClose={() => {}} />);
    expect(html).not.toContain('data-testid="signal-detail-panel"');
    expect(html).not.toContain('Visibility');
    expect(html).not.toContain('Refresh');
    expect(html).not.toContain('data-testid="slideshow-freshness"');
    expect(html).not.toContain('Updated ');
  });

  it('shows the empty state when no signal is eligible (all setup-needed)', () => {
    const setupSignal = liveSignal('a', {
      points: [],
      status: {
        status: 'error',
        last_ok_at: null,
        last_attempt_at: NOW,
        last_error: 'setup_required: needs TRADING_ECONOMICS_API_KEY',
        last_manual_request_at: null,
      },
    });
    const html = renderToString(<Slideshow signals={[setupSignal]} onClose={() => {}} />);
    expect(html).toContain('data-testid="slideshow-empty"');
    // Controls aren't useful when there's nothing to advance through, so
    // suppress them.
    expect(html).not.toContain('data-testid="slideshow-pause"');
  });

  it('starts with chrome + controls visible (pointer not yet idle on first paint)', () => {
    // Idle timer fires asynchronously, so the initial render must show
    // chrome at full opacity. Without that, opening presentation mode on
    // a touch device with no pointer movement would land on a blank screen.
    const html = renderToString(<Slideshow signals={[liveSignal('a')]} onClose={() => {}} />);
    expect(html).toContain('data-pointer-idle="false"');
    expect(html).toContain('data-testid="slideshow-chrome-wrapper"');
    expect(html).toContain('data-testid="slideshow-controls-wrapper"');
    // Wrappers default to fully visible (attribute order: class then testid).
    expect(html).toMatch(/opacity-100[^>]*slideshow-chrome-wrapper/);
    expect(html).toMatch(/opacity-100[^>]*slideshow-controls-wrapper/);
    expect(html).not.toContain('opacity-0');
    expect(html).not.toContain('cursor-none');
  });

  it('skips ineligible signals in the eligible count without dropping total', () => {
    const setupSignal = liveSignal('skip', {
      points: [],
      status: {
        status: 'error',
        last_ok_at: null,
        last_attempt_at: NOW,
        last_error: 'setup_required: missing',
        last_manual_request_at: null,
      },
    });
    const html = renderToString(
      <Slideshow signals={[liveSignal('a'), setupSignal, liveSignal('b')]} onClose={() => {}} />,
    );
    expect(html).toContain('presenting 2 of 3');
    expect(html).toContain('1 / 2');
  });
});
