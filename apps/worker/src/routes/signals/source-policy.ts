import {
  publicDisplayBlockerForPolicy,
  sourcePolicyForTemplate,
  type SourcePolicy,
} from '@antenna/registry';
import { canReadSignalWithSourcePolicy } from '../../policy/source-access';
import type { SourcePolicyShape } from './types';

export type PublicVisibilityBlocker = {
  readonly reason: string;
  readonly source_policy: SourcePolicyShape | null;
};

export const externalVisibilityBlocker = (
  templateId: string,
  visibility: 'shared' | 'public',
): PublicVisibilityBlocker | undefined => {
  const policy = sourcePolicyForTemplate(templateId);
  const decision = canReadSignalWithSourcePolicy({
    collectionVisibility: visibility,
    signalVisibility: visibility,
    policy,
    audience: visibility === 'public' ? 'public' : 'shared_link',
  });
  if (decision.ok) return undefined;
  return {
    reason: decision.reason,
    source_policy: toSourcePolicyShapeFromPolicy(policy),
  };
};

export const toSourcePolicyShape = (templateId: string): SourcePolicyShape | null =>
  toSourcePolicyShapeFromPolicy(sourcePolicyForTemplate(templateId));

const toSourcePolicyShapeFromPolicy = (
  policy: SourcePolicy | undefined,
): SourcePolicyShape | null => {
  if (!policy) return null;
  return {
    source_id: policy.sourceId,
    label: policy.label,
    source_url: policy.sourceUrl,
    rights_status: policy.rightsStatus,
    execution_mode: policy.executionMode,
    public_display_eligible: policy.publicDisplayEligible,
    public_display_blocker: publicDisplayBlockerForPolicy(policy),
    attribution: policy.attribution,
    last_reviewed: policy.lastReviewed,
  };
};
