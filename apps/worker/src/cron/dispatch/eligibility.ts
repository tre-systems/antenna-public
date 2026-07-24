import type { SourcePolicy } from '@antenna/registry';
import { canRefreshSignalFromCloud, type Visibility } from '../../policy/source-access';

export const cloudRefreshEligibility = (
  policy: SourcePolicy | undefined,
  collectionVisibility: Visibility,
  signalVisibility: Visibility,
): { ok: true } | { ok: false; message: string } => {
  const decision = canRefreshSignalFromCloud({ collectionVisibility, signalVisibility, policy });
  if (decision.ok) return { ok: true };
  return { ok: false, message: eligibilityMessage(policy, decision.reason) };
};

const eligibilityMessage = (policy: SourcePolicy | undefined, reason: string): string => {
  if (!policy) return 'setup_required: missing source policy for cloud refresh';
  if (reason === 'unsupported_rights_status:needs-review') {
    return `setup_required: ${policy.label} requires source review before cloud refresh`;
  }
  if (reason === 'unsupported_execution_mode:user_side_runner') {
    return `setup_required: ${policy.label} runs user-side and cannot be refreshed by cloud dispatch`;
  }
  return `setup_required: ${policy.label} cannot refresh externally visible signal (${reason})`;
};
