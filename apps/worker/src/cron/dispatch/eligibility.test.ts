import { describe, expect, it } from 'vitest';
import type { SourcePolicy } from '@antenna/registry';
import { cloudRefreshEligibility } from './eligibility';

const policy = (overrides: Partial<SourcePolicy> = {}): SourcePolicy => ({
  sourceId: 'synthetic',
  label: 'Synthetic Source',
  sourceUrl: 'https://example.test/',
  rightsStatus: 'public',
  executionMode: 'public_cloud',
  publicDisplayEligible: true,
  attribution: 'Synthetic',
  reviewNotes: 'Synthetic fixture.',
  lastReviewed: '2026-05-21',
  ...overrides,
});

describe('cloudRefreshEligibility', () => {
  it('reports setup_required when no source policy is registered', () => {
    expect(cloudRefreshEligibility(undefined, 'private', 'private')).toEqual({
      ok: false,
      message: 'setup_required: missing source policy for cloud refresh',
    });
  });

  it('blocks needs-review sources before any visibility check', () => {
    expect(
      cloudRefreshEligibility(policy({ rightsStatus: 'needs-review' }), 'private', 'private'),
    ).toEqual({
      ok: false,
      message: 'setup_required: Synthetic Source requires source review before cloud refresh',
    });
  });

  it('blocks user-side sources that cloud dispatch cannot run', () => {
    expect(
      cloudRefreshEligibility(policy({ executionMode: 'user_side_runner' }), 'private', 'private'),
    ).toEqual({
      ok: false,
      message:
        'setup_required: Synthetic Source runs user-side and cannot be refreshed by cloud dispatch',
    });
  });

  it('permits a private signal from an eligible public-cloud source', () => {
    expect(cloudRefreshEligibility(policy(), 'private', 'private')).toEqual({ ok: true });
  });

  it('permits an externally visible signal only when the source is public-display eligible', () => {
    expect(cloudRefreshEligibility(policy(), 'shared', 'shared')).toEqual({ ok: true });
    expect(
      cloudRefreshEligibility(policy({ publicDisplayEligible: false }), 'shared', 'shared'),
    ).toEqual({
      ok: false,
      message:
        'setup_required: Synthetic Source cannot refresh externally visible signal (source_not_public_display_eligible)',
    });
  });
});
