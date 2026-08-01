import { sourcePolicyForTemplate } from '@antenna/registry';
import {
  canReadSignalWithSourcePolicy,
  canReadSharedLinkSignalWithSourcePolicy,
  type Visibility,
} from '../../policy/source-access';

type SourcePolicyDecision = ReturnType<typeof canReadSignalWithSourcePolicy>;

export const externalVisibilityDecision = (
  templateId: string,
  visibility: Visibility,
): SourcePolicyDecision => {
  if (visibility === 'private') return { ok: true };
  const policy = sourcePolicyForTemplate(templateId);
  if (visibility === 'shared') {
    return canReadSharedLinkSignalWithSourcePolicy({
      collectionVisibility: 'shared',
      signalVisibility: 'shared',
      policy,
    });
  }
  return canReadSignalWithSourcePolicy({
    collectionVisibility: 'public',
    signalVisibility: 'public',
    policy,
    audience: 'public',
  });
};
