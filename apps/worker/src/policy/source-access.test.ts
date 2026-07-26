import { describe, expect, it } from 'vitest';
import type { SourcePolicy } from '@antenna/registry';
import {
  canReadSignalWithSourcePolicy,
  canReadSharedLinkSignalWithSourcePolicy,
  canReadTemplateWithSourcePolicy,
  canRefreshSignalFromCloud,
  externalReadAudience,
  type SourceAccessInput,
} from './source-access';

const PUBLIC_POLICY: SourcePolicy = {
  sourceId: 'example-public',
  label: 'Example Public',
  sourceUrl: 'https://example.test/',
  rightsStatus: 'public',
  executionMode: 'public_cloud',
  publicDisplayEligible: true,
  attribution: 'Example',
  reviewNotes: 'Test fixture.',
  lastReviewed: '2026-05-21',
};

const decision = (overrides: Partial<SourceAccessInput> = {}) =>
  canReadSignalWithSourcePolicy({
    collectionVisibility: 'shared',
    signalVisibility: 'shared',
    policy: PUBLIC_POLICY,
    audience: 'shared_link',
    ...overrides,
  });

describe('canReadSignalWithSourcePolicy', () => {
  it('always permits owner reads so private dogfood cards remain visible to owners', () => {
    expect(
      decision({
        collectionVisibility: 'private',
        signalVisibility: 'private',
        policy: undefined,
        audience: 'owner',
      }),
    ).toEqual({ ok: true });
  });

  it('permits shared-link reads only when collection, signal, and source policy allow it', () => {
    expect(decision()).toEqual({ ok: true });
    expect(decision({ collectionVisibility: 'public', signalVisibility: 'public' })).toEqual({
      ok: true,
    });
  });

  it('requires public visibility for public reads', () => {
    expect(decision({ audience: 'public' })).toEqual({
      ok: false,
      reason: 'collection_visibility:shared',
    });
    expect(
      decision({ audience: 'public', collectionVisibility: 'public', signalVisibility: 'public' }),
    ).toEqual({ ok: true });
  });

  it('signals external reads for private collections or private signals', () => {
    expect(decision({ collectionVisibility: 'private' })).toEqual({
      ok: false,
      reason: 'collection_visibility:private',
    });
    expect(decision({ signalVisibility: 'private' })).toEqual({
      ok: false,
      reason: 'signal_visibility:private',
    });
  });

  it('signals external reads when source policy is missing or not display eligible', () => {
    expect(decision({ policy: undefined })).toEqual({ ok: false, reason: 'missing_source_policy' });
    expect(decision({ policy: { ...PUBLIC_POLICY, publicDisplayEligible: false } })).toEqual({
      ok: false,
      reason: 'source_not_public_display_eligible',
    });
  });

  it('signals external reads for private-cloud, user-runner, auth, and unreviewed sources', () => {
    expect(decision({ policy: { ...PUBLIC_POLICY, executionMode: 'private_cloud' } })).toEqual({
      ok: false,
      reason: 'unsupported_execution_mode:private_cloud',
    });
    expect(decision({ policy: { ...PUBLIC_POLICY, executionMode: 'user_side_runner' } })).toEqual({
      ok: false,
      reason: 'unsupported_execution_mode:user_side_runner',
    });
    expect(decision({ policy: { ...PUBLIC_POLICY, rightsStatus: 'requires-auth' } })).toEqual({
      ok: false,
      reason: 'unsupported_rights_status:requires-auth',
    });
    expect(decision({ policy: { ...PUBLIC_POLICY, rightsStatus: 'needs-review' } })).toEqual({
      ok: false,
      reason: 'unsupported_rights_status:needs-review',
    });
  });
});

describe('canReadSharedLinkSignalWithSourcePolicy', () => {
  const sharedDecision = (overrides: Partial<Omit<SourceAccessInput, 'audience'>> = {}) =>
    canReadSharedLinkSignalWithSourcePolicy({
      collectionVisibility: 'shared',
      signalVisibility: 'shared',
      policy: PUBLIC_POLICY,
      ...overrides,
    });

  it('permits reviewed public-cloud sources only when public-display eligible', () => {
    expect(sharedDecision()).toEqual({ ok: true });
    expect(sharedDecision({ policy: { ...PUBLIC_POLICY, publicDisplayEligible: false } })).toEqual({
      ok: false,
      reason: 'source_not_public_display_eligible',
    });
  });

  it('still requires shared-compatible visibility and reviewed public-cloud source policy', () => {
    expect(sharedDecision({ collectionVisibility: 'private' })).toEqual({
      ok: false,
      reason: 'collection_visibility:private',
    });
    expect(sharedDecision({ signalVisibility: 'private' })).toEqual({
      ok: false,
      reason: 'signal_visibility:private',
    });
    expect(sharedDecision({ policy: undefined })).toEqual({
      ok: false,
      reason: 'missing_source_policy',
    });
    expect(
      sharedDecision({ policy: { ...PUBLIC_POLICY, executionMode: 'private_cloud' } }),
    ).toEqual({
      ok: false,
      reason: 'unsupported_execution_mode:private_cloud',
    });
    expect(sharedDecision({ policy: { ...PUBLIC_POLICY, rightsStatus: 'requires-auth' } })).toEqual(
      {
        ok: false,
        reason: 'unsupported_rights_status:requires-auth',
      },
    );
    expect(sharedDecision({ policy: { ...PUBLIC_POLICY, rightsStatus: 'needs-review' } })).toEqual({
      ok: false,
      reason: 'unsupported_rights_status:needs-review',
    });
  });
});

describe('canReadTemplateWithSourcePolicy', () => {
  const sharedInput = {
    collectionVisibility: 'shared' as const,
    signalVisibility: 'shared' as const,
    audience: 'shared_link' as const,
  };

  it('resolves source policy by template id instead of trusting caller-provided metadata', () => {
    expect(canReadTemplateWithSourcePolicy({ ...sharedInput, templateId: 'fx-pair' })).toEqual({
      ok: true,
    });
    expect(
      canReadTemplateWithSourcePolicy({ ...sharedInput, templateId: 'github-security-advisories' }),
    ).toEqual({ ok: true });
    expect(
      canReadTemplateWithSourcePolicy({ ...sharedInput, templateId: 'cloudflare-incidents' }),
    ).toEqual({ ok: true });
    expect(
      canReadTemplateWithSourcePolicy({ ...sharedInput, templateId: 'uk-economic-calendar' }),
    ).toEqual({ ok: true });
  });

  it('signals real templates that are private, auth-backed, user-runner, or not public-display eligible', () => {
    expect(
      canReadTemplateWithSourcePolicy({ ...sharedInput, templateId: 'market-overview' }),
    ).toEqual({
      ok: false,
      reason: 'source_not_public_display_eligible',
    });
    expect(
      canReadTemplateWithSourcePolicy({ ...sharedInput, templateId: 'market-history' }),
    ).toEqual({
      ok: false,
      reason: 'source_not_public_display_eligible',
    });
    expect(
      canReadTemplateWithSourcePolicy({ ...sharedInput, templateId: 'manual-metric' }),
    ).toEqual({
      ok: false,
      reason: 'source_not_public_display_eligible',
    });
    expect(canReadTemplateWithSourcePolicy({ ...sharedInput, templateId: 'rest-metric' })).toEqual({
      ok: false,
      reason: 'source_not_public_display_eligible',
    });
    expect(
      canReadTemplateWithSourcePolicy({ ...sharedInput, templateId: 'tbench-leaderboard' }),
    ).toEqual({
      ok: false,
      reason: 'source_not_public_display_eligible',
    });
  });

  it('returns missing_source_policy for unknown templates', () => {
    expect(
      canReadTemplateWithSourcePolicy({ ...sharedInput, templateId: 'unknown-template' }),
    ).toEqual({
      ok: false,
      reason: 'missing_source_policy',
    });
  });
});

describe('canRefreshSignalFromCloud', () => {
  it('permits private cloud refresh for private auth-backed signals', () => {
    expect(
      canRefreshSignalFromCloud({
        collectionVisibility: 'private',
        signalVisibility: 'private',
        policy: {
          ...PUBLIC_POLICY,
          rightsStatus: 'requires-auth',
          executionMode: 'private_cloud',
          publicDisplayEligible: false,
        },
      }),
    ).toEqual({ ok: true });
  });

  it('fails closed when source policy is missing, unreviewed, or user-side only', () => {
    expect(
      canRefreshSignalFromCloud({
        collectionVisibility: 'private',
        signalVisibility: 'private',
        policy: undefined,
      }),
    ).toEqual({ ok: false, reason: 'missing_source_policy' });
    expect(
      canRefreshSignalFromCloud({
        collectionVisibility: 'private',
        signalVisibility: 'private',
        policy: { ...PUBLIC_POLICY, rightsStatus: 'needs-review' },
      }),
    ).toEqual({ ok: false, reason: 'unsupported_rights_status:needs-review' });
    expect(
      canRefreshSignalFromCloud({
        collectionVisibility: 'private',
        signalVisibility: 'private',
        policy: { ...PUBLIC_POLICY, executionMode: 'user_side_runner' },
      }),
    ).toEqual({ ok: false, reason: 'unsupported_execution_mode:user_side_runner' });
  });

  it('uses the external read gate before refreshing shared or public signals', () => {
    expect(
      canRefreshSignalFromCloud({
        collectionVisibility: 'shared',
        signalVisibility: 'shared',
        policy: PUBLIC_POLICY,
      }),
    ).toEqual({ ok: true });
    expect(
      canRefreshSignalFromCloud({
        collectionVisibility: 'shared',
        signalVisibility: 'shared',
        policy: { ...PUBLIC_POLICY, publicDisplayEligible: false },
      }),
    ).toEqual({ ok: false, reason: 'source_not_public_display_eligible' });
    expect(
      canRefreshSignalFromCloud({
        collectionVisibility: 'public',
        signalVisibility: 'public',
        policy: { ...PUBLIC_POLICY, publicDisplayEligible: false },
      }),
    ).toEqual({ ok: false, reason: 'source_not_public_display_eligible' });
    expect(
      canRefreshSignalFromCloud({
        collectionVisibility: 'public',
        signalVisibility: 'public',
        policy: { ...PUBLIC_POLICY, executionMode: 'private_cloud' },
      }),
    ).toEqual({ ok: false, reason: 'unsupported_execution_mode:private_cloud' });
  });
});

describe('externalReadAudience', () => {
  it('returns null for private combinations that are owner-only', () => {
    expect(externalReadAudience('private', 'private')).toBeNull();
    expect(externalReadAudience('private', 'shared')).toBeNull();
    expect(externalReadAudience('shared', 'private')).toBeNull();
    expect(externalReadAudience('public', 'private')).toBeNull();
  });

  it('classifies shared and public exposure consistently for routes and dispatch', () => {
    expect(externalReadAudience('shared', 'shared')).toBe('shared_link');
    expect(externalReadAudience('shared', 'public')).toBe('shared_link');
    expect(externalReadAudience('public', 'shared')).toBe('shared_link');
    expect(externalReadAudience('public', 'public')).toBe('public');
  });
});
