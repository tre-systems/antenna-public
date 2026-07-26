import { describe, expect, it } from 'vitest';
import { templates } from './index';
import {
  publicDisplayBlockerForPolicy,
  publicDisplayBlockerForTemplate,
  sourceLabelForTemplate,
  sourcePolicyForTemplate,
  type SourcePolicy,
} from './source-policy';

const PUBLIC_DISPLAY_READY = [
  'airquality',
  'cisa-kev-recent',
  'cloudflare-incidents',
  'crypto-history',
  'crypto-watchlist',
  'fx-pair',
  'github-repo-activity',
  'github-security-advisories',
  'uk-economic-calendar',
  'weather',
] as const;

const PUBLIC_DISPLAY_BLOCKED = {
  'aa-frontier': /private display with attribution/i,
  'aa-highlights': /public display needs rights review/i,
  'antenna-users': /never public-display eligible/i,
  'app-usage': /private-only by design/i,
  'cloudflare-analytics': /private-only by design/i,
  'equity-watchlist': /replace before public sharing/i,
  'karpathy-jobs-snapshot': /public display needs source-rights review/i,
  'macro-market-history': /review each preset before public display/i,
  'manual-cost': /not public-display eligible/i,
  'manual-metric': /not public-display eligible/i,
  'market-history': /replace before public sharing/i,
  'market-overview': /replace before public sharing/i,
  'reddit-problems': /public display needs rights review/i,
  'project-portfolio': /Private aggregate/i,
  'rest-metric': /Disabled for planner matching/i,
  'sector-movers': /replace before public sharing/i,
  'github-trending': /public display needs review/i,
  'tbench-leaderboard': /public display needs review/i,
  'trading-economics-market': /keep as setup\/future source/i,
} satisfies Record<string, RegExp>;

describe('source policy metadata', () => {
  it('covers every registered template', () => {
    for (const template of templates) {
      const policy = sourcePolicyForTemplate(template.id);
      expect(policy, template.id).toBeDefined();
      expect(policy?.sourceId).toMatch(/^[a-z0-9-]+$/);
      expect(policy?.label.length).toBeGreaterThan(0);
      expect(policy?.sourceUrl).toMatch(/^https:\/\//);
      expect(policy?.attribution.length).toBeGreaterThan(0);
      expect(policy?.reviewNotes.length).toBeGreaterThan(0);
      expect(policy?.lastReviewed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('keeps template rights metadata aligned with source policy', () => {
    for (const template of templates) {
      const policy = sourcePolicyForTemplate(template.id);

      expect(template.rightsStatus, template.id).toBe(policy?.rightsStatus);
    }
  });

  it('keeps planner source labels backed by source policy', () => {
    expect(sourceLabelForTemplate('weather', 'Weather')).toBe('Open-Meteo');
    expect(sourceLabelForTemplate('unknown-template', 'Fallback')).toBe('Fallback');
  });

  it('marks generic REST as not public-display eligible', () => {
    expect(sourcePolicyForTemplate('rest-metric')).toMatchObject({
      sourceId: 'generic-rest',
      rightsStatus: 'needs-review',
      publicDisplayEligible: false,
    });
  });

  it('pins the current public-collection display eligibility matrix', () => {
    const documentedIds = new Set([
      ...PUBLIC_DISPLAY_READY,
      ...Object.keys(PUBLIC_DISPLAY_BLOCKED),
    ]);
    expect(documentedIds).toEqual(new Set(templates.map((template) => template.id)));

    for (const templateId of PUBLIC_DISPLAY_READY) {
      expect(publicDisplayBlockerForTemplate(templateId), templateId).toBeNull();
    }
    for (const [templateId, blockerPattern] of Object.entries(PUBLIC_DISPLAY_BLOCKED)) {
      expect(publicDisplayBlockerForTemplate(templateId), templateId).toMatch(blockerPattern);
    }
  });

  // No real template is publicDisplayEligible with a non-public-cloud execution
  // mode or restricted rights, so these blocker branches have no template that
  // reaches them. Exercise them directly with a synthetic policy.
  it('reports a specific blocker for each non-public-cloud / restricted-rights reason', () => {
    const base: SourcePolicy = {
      sourceId: 'synthetic',
      label: 'Synthetic',
      sourceUrl: 'https://example.test/',
      rightsStatus: 'public',
      executionMode: 'public_cloud',
      publicDisplayEligible: true,
      attribution: 'Synthetic',
      reviewNotes: 'Synthetic review notes.',
      lastReviewed: '2026-05-21',
    };

    expect(publicDisplayBlockerForPolicy(undefined)).toMatch(/missing source policy/i);
    expect(publicDisplayBlockerForPolicy({ ...base, publicDisplayEligible: false })).toBe(
      'Synthetic review notes.',
    );
    expect(publicDisplayBlockerForPolicy({ ...base, executionMode: 'private_cloud' })).toMatch(
      /private cloud credentials/i,
    );
    expect(publicDisplayBlockerForPolicy({ ...base, executionMode: 'user_side_runner' })).toMatch(
      /public-safe snapshot handling is not implemented yet/i,
    );
    expect(publicDisplayBlockerForPolicy({ ...base, rightsStatus: 'requires-auth' })).toMatch(
      /requires per-user authentication/i,
    );
    expect(publicDisplayBlockerForPolicy({ ...base, rightsStatus: 'needs-review' })).toMatch(
      /needs source-rights review/i,
    );
    expect(publicDisplayBlockerForPolicy(base)).toBeNull();
  });
});
