import { useState } from 'preact/hooks';
import { confirmPlan, rejectPlan } from '../api';
import { clearPlan, currentPlan, planError } from '../signals/plan';
import type { ProposedSignal, SourceBlockerReason } from '@antenna/shared';
import { PlanSignalRow } from './PlanSignalRow';

type Props = { onConfirmed: (createdSignalIds: readonly string[]) => void };

const BLOCKER_COPY: Record<SourceBlockerReason, string> = {
  irrelevant_request: 'This does not look like a collection source yet.',
  unsupported_source: 'No reviewed connector is available for this source yet.',
  unsupported_symbol: 'This symbol is not supported by the current market connectors.',
  source_rights_blocked: 'This needs source-rights review before it can be added.',
  auth_required_source: 'This source needs account access before Antenna can connect it.',
  private_display_only_source: 'This source must stay private and cannot be proposed here.',
  unsafe_generated_extraction: 'Antenna needs source review before fetching arbitrary URLs.',
};

export function PlanPreview({ onConfirmed }: Props) {
  const plan = currentPlan.value;
  // plan.signals is readonly on the wire; copy it so missing fields stay editable.
  const [signals, setSignals] = useState<ProposedSignal[]>(() => [...(plan?.plan.signals ?? [])]);
  const [busy, setBusy] = useState<'confirm' | 'reject' | null>(null);

  if (plan === null) return null;

  const allResolved = signals.every((signal) => signal.missing.length === 0);
  const canConfirm = signals.length > 0 && allResolved && busy === null;

  const handleSignalChange = (
    index: number,
    update: (current: ProposedSignal) => ProposedSignal,
  ) => {
    setSignals((prev) => prev.map((signal, i) => (i === index ? update(signal) : signal)));
  };

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setBusy('confirm');
    try {
      const result = await confirmPlan(plan.id, signals);
      clearPlan();
      onConfirmed(result.created_signal_ids);
    } catch (err) {
      planError.value = err instanceof Error ? err.message : 'Failed to confirm plan.';
    } finally {
      setBusy(null);
    }
  };

  const handleReject = async () => {
    if (busy !== null) return;
    setBusy('reject');
    try {
      await rejectPlan(plan.id);
      clearPlan();
    } catch (err) {
      planError.value = err instanceof Error ? err.message : 'Failed to reject plan.';
    } finally {
      setBusy(null);
    }
  };

  return (
    <div class="border-t border-slate-900/10 pt-4 dark:border-white/10" data-testid="plan-preview">
      <header class="mb-3">
        <h3 class="text-sm font-semibold text-slate-900 dark:text-white">
          {signals.length === 1 ? 'Proposed card' : 'Proposed cards'}
        </h3>
        <p class="mt-0.5 text-xs italic text-slate-500 dark:text-slate-400">"{plan.prompt}"</p>
      </header>

      {signals.length === 0 ? (
        <p class="text-sm text-slate-500 dark:text-slate-400">No matching connectors yet.</p>
      ) : (
        <ul class="space-y-3">
          {signals.map((signal, idx) => (
            <PlanSignalRow
              key={`${signal.template_id}-${String(idx)}`}
              signal={signal}
              index={idx}
              onChange={handleSignalChange}
            />
          ))}
        </ul>
      )}

      {plan.plan.unmatched.length > 0 ? (
        <ul class="mt-3 space-y-1">
          {plan.plan.unmatched.map((u) => (
            <li key={u.fragment} class="text-xs italic text-slate-500 dark:text-slate-400">
              We couldn't connect "{u.fragment}" yet —{' '}
              {u.blocker_reason ? BLOCKER_COPY[u.blocker_reason] : 'saved as a connector request.'}
            </li>
          ))}
        </ul>
      ) : null}

      <div class="mt-4 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            void handleReject();
          }}
          disabled={busy !== null}
          class="rounded-lg bg-white/40 px-3 py-1.5 text-sm font-medium text-slate-600 ring-1 ring-slate-900/10 transition hover:bg-white/70 disabled:opacity-50 dark:bg-white/5 dark:text-slate-200 dark:ring-white/10 dark:hover:bg-white/10"
          data-testid="plan-preview-reject"
        >
          {busy === 'reject' ? 'Cancelling…' : 'Cancel'}
        </button>
        <button
          type="button"
          onClick={() => {
            void handleConfirm();
          }}
          disabled={!canConfirm}
          class="antenna-primary rounded-lg px-3 py-1.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
          data-testid="plan-preview-confirm"
        >
          {busy === 'confirm' ? 'Adding…' : 'Add to collection'}
        </button>
      </div>
    </div>
  );
}
