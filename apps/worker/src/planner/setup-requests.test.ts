import { describe, expect, it } from 'vitest';
import { enrichConnectorRequest } from './setup-requests';

describe('enrichConnectorRequest', () => {
  it('recognises known daily-collection sources', () => {
    expect(enrichConnectorRequest('https://tradingeconomics.com/commodity/gold')).toMatchObject({
      source_label: 'Trading Economics',
      candidate_template_id: 'trading-economics-market',
      rights_status: 'needs-review',
      blocker_reason: 'source_rights_blocked',
      acquisition_state: 'needs_source_review',
      acquisition_strategy: 'public_api_json',
    });
    expect(enrichConnectorRequest('Artificial Analysis leaderboard')).toMatchObject({
      source_label: 'Artificial Analysis',
      candidate_template_id: 'aa-highlights',
      setup_hint: 'Available now as Artificial Analysis highlights.',
      acquisition_state: 'known_connector',
      acquisition_strategy: 'first_class_connector',
    });
    expect(enrichConnectorRequest('Finviz screener')).toMatchObject({
      source_label: 'Finviz',
      candidate_template_id: 'finviz-screener-snapshot',
      blocker_reason: 'source_rights_blocked',
      acquisition_state: 'needs_source_review',
      acquisition_strategy: 'static_html_table',
    });
    expect(enrichConnectorRequest('Terminal Bench leaderboard')).toMatchObject({
      source_label: 'Terminal-Bench',
      candidate_template_id: 'tbench-leaderboard',
      setup_hint: 'Available now as Terminal Bench leaderboard.',
    });
    expect(enrichConnectorRequest('are there any new high severity npm vulns')).toMatchObject({
      source_label: 'GitHub Security Advisories',
      candidate_template_id: 'github-security-advisories',
    });
    expect(enrichConnectorRequest('workers kv down')).toMatchObject({
      source_label: 'Cloudflare Status',
      candidate_template_id: 'cloudflare-incidents',
    });
    expect(enrichConnectorRequest('security vulnerabilities being exploited')).toMatchObject({
      source_label: 'CISA KEV',
      candidate_template_id: 'cisa-kev-recent',
    });
  });

  it('falls back to a source URL when no known source matches', () => {
    expect(enrichConnectorRequest('https://example.test/report')).toEqual({
      blocker_reason: 'unsafe_generated_extraction',
      acquisition_state: 'generated_candidate',
      acquisition_strategy: 'manual_blocker',
      source_url: 'https://example.test/report',
      setup_hint: 'Needs source review and connector design before Antenna can fetch this URL.',
    });
  });

  it('classifies generic unmatched prompts with typed blocker reasons', () => {
    expect(enrichConnectorRequest('how is your day')).toMatchObject({
      blocker_reason: 'irrelevant_request',
      acquisition_state: 'irrelevant_match',
      acquisition_strategy: 'manual_blocker',
    });
    expect(enrichConnectorRequest('my private bank balance')).toMatchObject({
      blocker_reason: 'auth_required_source',
      acquisition_state: 'needs_credentials',
      acquisition_strategy: 'browser_session_setup',
    });
    expect(enrichConnectorRequest('XYZ price chart')).toMatchObject({
      blocker_reason: 'unsupported_symbol',
      acquisition_state: 'source_unavailable',
      acquisition_strategy: 'manual_blocker',
    });
  });
});
