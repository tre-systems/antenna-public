import { sourcePolicyForTemplate, type SourcePolicy } from '@antenna/registry';

export type Visibility = 'private' | 'shared' | 'public';
export type ReadAudience = 'owner' | 'shared_link' | 'public';

export type SourceAccessInput = {
  readonly collectionVisibility: Visibility;
  readonly signalVisibility: Visibility;
  readonly policy: SourcePolicy | undefined;
  readonly audience: ReadAudience;
};

export type SourceAccessDecision =
  { readonly ok: true } | { readonly ok: false; readonly reason: string };

export type CloudRefreshInput = {
  readonly collectionVisibility: Visibility;
  readonly signalVisibility: Visibility;
  readonly policy: SourcePolicy | undefined;
};

export const canReadSignalWithSourcePolicy = (input: SourceAccessInput): SourceAccessDecision => {
  if (input.audience === 'owner') return { ok: true };

  const visibilityDecision = canReadExternalVisibility(input, input.audience);
  if (!visibilityDecision.ok) return visibilityDecision;

  const policy = input.policy;
  if (!policy) {
    return { ok: false, reason: 'missing_source_policy' };
  }
  if (!policy.publicDisplayEligible) {
    return { ok: false, reason: 'source_not_public_display_eligible' };
  }
  return canReadReviewedPublicCloudSource(policy);
};

export const canReadSharedLinkSignalWithSourcePolicy = (
  input: Omit<SourceAccessInput, 'audience'>,
): SourceAccessDecision => canReadSignalWithSourcePolicy({ ...input, audience: 'shared_link' });

const canReadExternalVisibility = (
  input: Pick<SourceAccessInput, 'collectionVisibility' | 'signalVisibility'>,
  audience: Exclude<ReadAudience, 'owner'>,
): SourceAccessDecision => {
  const collectionDecision = allowsAudience(input.collectionVisibility, audience, 'collection');
  if (!collectionDecision.ok) return collectionDecision;

  const signalDecision = allowsAudience(input.signalVisibility, audience, 'signal');
  if (!signalDecision.ok) return signalDecision;

  return { ok: true };
};

const canReadReviewedPublicCloudSource = (policy: SourcePolicy): SourceAccessDecision => {
  if (policy.executionMode !== 'public_cloud') {
    return { ok: false, reason: `unsupported_execution_mode:${policy.executionMode}` };
  }
  if (policy.rightsStatus === 'requires-auth' || policy.rightsStatus === 'needs-review') {
    return { ok: false, reason: `unsupported_rights_status:${policy.rightsStatus}` };
  }

  return { ok: true };
};

export const canReadTemplateWithSourcePolicy = (
  input: Omit<SourceAccessInput, 'policy'> & { readonly templateId: string },
): SourceAccessDecision =>
  canReadSignalWithSourcePolicy({
    ...input,
    policy: sourcePolicyForTemplate(input.templateId),
  });

export const canRefreshSignalFromCloud = (input: CloudRefreshInput): SourceAccessDecision => {
  const policy = input.policy;
  if (!policy) {
    return { ok: false, reason: 'missing_source_policy' };
  }
  if (policy.rightsStatus === 'needs-review') {
    return { ok: false, reason: 'unsupported_rights_status:needs-review' };
  }
  if (policy.executionMode === 'user_side_runner') {
    return { ok: false, reason: 'unsupported_execution_mode:user_side_runner' };
  }

  const externalAudience = externalReadAudience(input.collectionVisibility, input.signalVisibility);
  if (externalAudience === null) return { ok: true };
  if (externalAudience === 'shared_link') {
    return canReadSharedLinkSignalWithSourcePolicy(input);
  }

  return canReadSignalWithSourcePolicy({
    collectionVisibility: input.collectionVisibility,
    signalVisibility: input.signalVisibility,
    policy,
    audience: externalAudience,
  });
};

export const externalReadAudience = (
  collectionVisibility: Visibility,
  signalVisibility: Visibility,
): Exclude<ReadAudience, 'owner'> | null => {
  if (collectionVisibility === 'public' && signalVisibility === 'public') return 'public';
  if (
    (collectionVisibility === 'shared' || collectionVisibility === 'public') &&
    (signalVisibility === 'shared' || signalVisibility === 'public')
  ) {
    return 'shared_link';
  }
  return null;
};

const allowsAudience = (
  visibility: Visibility,
  audience: Exclude<ReadAudience, 'owner'>,
  subject: 'collection' | 'signal',
): SourceAccessDecision => {
  if (audience === 'shared_link' && (visibility === 'shared' || visibility === 'public')) {
    return { ok: true };
  }
  if (audience === 'public' && visibility === 'public') {
    return { ok: true };
  }
  return { ok: false, reason: `${subject}_visibility:${visibility}` };
};
