import { sourcePolicyForTemplate } from '@antenna/registry';
import {
  canReadSignalWithSourcePolicy,
  canReadSharedLinkSignalWithSourcePolicy,
  type Visibility,
} from '../../policy/source-access';
import type { SignalRow, ForkableSignalSelection, SkippedCollectionSignal } from './types';

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

export const selectForkableSignals = (
  signals: ReadonlyArray<SignalRow>,
  targetVisibility: Visibility,
): ForkableSignalSelection => {
  const selected: SignalRow[] = [];
  const skipped: SkippedCollectionSignal[] = [];

  for (const signal of signals) {
    const decision = forkabilityDecision(signal, targetVisibility);
    if (decision.ok) {
      selected.push(signal);
      continue;
    }
    skipped.push(skippedSignal(signal, decision.reason));
  }

  return { signals: selected, skipped };
};

const forkabilityDecision = (
  signal: SignalRow,
  targetVisibility: Visibility,
): SourcePolicyDecision => {
  const sourceDecision = canReadSignalWithSourcePolicy({
    collectionVisibility: 'public',
    signalVisibility: signal.visibility,
    policy: sourcePolicyForTemplate(signal.templateId),
    audience: 'public',
  });
  return sourceDecision.ok
    ? externalVisibilityDecision(signal.templateId, targetVisibility)
    : sourceDecision;
};

const skippedSignal = (signal: SignalRow, reason: string): SkippedCollectionSignal => ({
  id: signal.id,
  title: signal.title,
  template_id: signal.templateId,
  reason,
});
