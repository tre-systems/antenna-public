// Render-only tests via preact-render-to-string. The save flow needs a real
// DOM (select onChange + click) and is exercised in e2e.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import renderToString from 'preact-render-to-string';
import { SignalSettingsPanel } from './SignalSettingsPanel';
import { signals, settingsSignalId } from '../signals/signals';
import type { ApiSignal } from '../api';

const signal = (overrides: Partial<ApiSignal> = {}): ApiSignal => ({
  id: 'b1',
  template_id: 'fx-pair',
  visibility: 'private',
  config: { base: 'EUR', quote: 'USD' },
  refresh_seconds: 900,
  status: {
    status: 'live',
    last_ok_at: 0,
    last_attempt_at: 0,
    last_error: null,
    last_manual_request_at: null,
  },
  points: [],
  ...overrides,
});

beforeEach(() => {
  settingsSignalId.value = null;
  signals.value = null;
});

afterEach(() => {
  settingsSignalId.value = null;
  signals.value = null;
});

describe('SignalSettingsPanel', () => {
  it('renders nothing when no settingsSignalId is set', () => {
    expect(renderToString(<SignalSettingsPanel />)).toBe('');
  });

  it('renders the dialog with the signal title and current cadence preset', () => {
    signals.value = [signal({ refresh_seconds: 3600 })];
    settingsSignalId.value = 'b1';
    const html = renderToString(<SignalSettingsPanel />);
    expect(html).toContain('data-testid="signal-settings-panel"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('EUR/USD');
    // The 1h preset matches an option, so the dropdown shows it selected.
    // Attribute order varies (`selected` may render before `value`), so
    // assert the value attribute and label separately on the same tag.
    expect(html).toMatch(/<option[^>]*selected[^>]*value="3600"/);
    expect(html).toContain('Every hour</option>');
  });

  it('includes a "Current:" sentinel option when the signal refresh is not a preset', () => {
    signals.value = [signal({ refresh_seconds: 90 })];
    settingsSignalId.value = 'b1';
    const html = renderToString(<SignalSettingsPanel />);
    expect(html).toContain('Current:');
    expect(html).toMatch(/<option[^>]*value="90"/);
  });

  it('renders nothing when the open signal id is unknown (e.g. just deleted)', () => {
    signals.value = [signal({ id: 'other' })];
    settingsSignalId.value = 'b1';
    expect(renderToString(<SignalSettingsPanel />)).toBe('');
  });

  it('renders the visibility radio group with the current option checked', () => {
    signals.value = [signal({ visibility: 'private' })];
    settingsSignalId.value = 'b1';
    const html = renderToString(<SignalSettingsPanel />);
    expect(html).toContain('data-testid="signal-settings-visibility"');
    // Attribute order varies — `checked` may render before `data-testid` —
    // so match each radio's tag and assert the pairing both ways round.
    expect(html).toMatch(/<input[^>]*checked[^>]*data-testid="signal-visibility-private"/);
    expect(html).not.toMatch(/<input[^>]*checked[^>]*data-testid="signal-visibility-shared"/);
    expect(html).not.toContain('data-testid="signal-visibility-public"');
  });

  it('disables the Shared option and surfaces the reason when source policy blocks it', () => {
    signals.value = [
      signal({
        source_policy: {
          source_id: 'yahoo',
          label: 'Yahoo Finance',
          source_url: 'https://finance.yahoo.com/',
          rights_status: 'with-attribution',
          execution_mode: 'public_cloud',
          public_display_eligible: false,
          public_display_blocker: 'Yahoo Finance — private-only stopgap.',
          attribution: 'Yahoo Finance',
          last_reviewed: '2026-05-21',
        },
      }),
    ];
    settingsSignalId.value = 'b1';
    const html = renderToString(<SignalSettingsPanel />);
    expect(html).toMatch(/<input[^>]*disabled[^>]*data-testid="signal-visibility-shared"/);
    expect(html).toContain("Can't be shared:");
    expect(html).toContain('source policy blocks public links for this signal');
    expect(html).not.toContain('private-only stopgap');
  });

  it('renders a Configuration fieldset with one input per editable config field', () => {
    signals.value = [signal({ config: { base: 'EUR', quote: 'USD' } })];
    settingsSignalId.value = 'b1';
    const html = renderToString(<SignalSettingsPanel />);
    expect(html).toContain('data-testid="signal-settings-config"');
    expect(html).toMatch(/<input[^>]*value="EUR"[^>]*data-testid="signal-settings-config-base"/);
    expect(html).toMatch(/<input[^>]*value="USD"[^>]*data-testid="signal-settings-config-quote"/);
    expect(html).toContain('Base');
    expect(html).toContain('Quote');
  });

  it('uses a number input for numeric config fields', () => {
    signals.value = [
      signal({
        template_id: 'weather',
        config: { location: 'London', lat: 51.5074, lon: -0.1278 },
      }),
    ];
    settingsSignalId.value = 'b1';
    const html = renderToString(<SignalSettingsPanel />);
    expect(html).toMatch(/<input[^>]*type="number"[^>]*data-testid="signal-settings-config-lat"/);
    expect(html).toMatch(/<input[^>]*type="number"[^>]*data-testid="signal-settings-config-lon"/);
    expect(html).toMatch(
      /<input[^>]*type="text"[^>]*data-testid="signal-settings-config-location"/,
    );
  });

  it('omits the Configuration fieldset when there are no editable scalar fields', () => {
    signals.value = [signal({ config: {} })];
    settingsSignalId.value = 'b1';
    const html = renderToString(<SignalSettingsPanel />);
    expect(html).not.toContain('data-testid="signal-settings-config"');
  });
});
