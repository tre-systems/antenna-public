import { describe, expect, it, vi } from 'vitest';
import renderToString from 'preact-render-to-string';
import type { SignalAlertRecord, NotificationPreferenceRecord } from '../api';
import {
  formatAlertValue,
  NotificationPreferencePanel,
  SettingsActivity,
} from './SettingsActivity';

const preference: NotificationPreferenceRecord = {
  collection_id: null,
  channel: 'daily_digest',
  enabled: true,
  frequency: 'daily',
  quiet_hours_start: null,
  quiet_hours_end: null,
  updated_at: 1000,
};

const alert: SignalAlertRecord = {
  id: 'alert-1',
  collection_id: 'collection-1',
  signal_id: 'signal-1',
  template_id: 'market-history',
  title: 'AZN.L',
  rule_id: 'large_move',
  rule_label: 'Large move',
  metric_key: 'close',
  observed_at: 2000,
  triggered_at: 3000,
  value: 102.5,
  previous_value: 100,
  unit: 'GBP',
  source_url: 'https://finance.yahoo.com/quote/AZN.L/',
};

describe('SettingsActivity', () => {
  it('renders the loading shell before API data arrives', () => {
    const html = renderToString(<SettingsActivity collection={null} />);
    expect(html).toContain('Activity');
    expect(html).toContain('data-testid="activity-loading"');
  });

  it('renders daily brief controls', () => {
    const html = renderToString(
      <NotificationPreferencePanel
        preference={preference}
        saving={false}
        error={null}
        onChange={vi.fn()}
      />,
    );

    expect(html).toContain('data-testid="activity-notifications"');
    expect(html).toContain('Brief on');
    expect(html).toContain('data-testid="activity-digest-frequency-daily"');
    expect(html).toContain('data-testid="activity-digest-frequency-weekly"');
  });

  it('formats alert value changes with units', () => {
    expect(formatAlertValue(alert)).toBe('100 → 102.5 GBP');
  });
});
