import type { ApiSignal } from '../../api';
import { relativeTime } from '../../relative-time';
import type { CardStatus, RenderSignal } from './types';

type Props = {
  readonly signal: RenderSignal;
  readonly cardStatus: CardStatus;
  readonly editableSignal: ApiSignal | null;
  readonly source: string;
};

type Detail = {
  readonly label: string;
  readonly value: string;
};

export function SignalCardDetails({ signal, cardStatus, editableSignal, source }: Props) {
  const details = signalDetails(signal, cardStatus, editableSignal, source);

  return (
    <div
      class="mt-4 border-t border-slate-200/70 pt-3 dark:border-white/10"
      data-testid="signal-detail-panel"
    >
      <dl class="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
        {details.map((detail) => (
          <DetailItem key={detail.label} detail={detail} />
        ))}
      </dl>
    </div>
  );
}

function DetailItem({ detail }: { readonly detail: Detail }) {
  return (
    <div class="min-w-0">
      <dt class="text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
        {detail.label}
      </dt>
      <dd class="mt-0.5 truncate font-medium text-slate-700 dark:text-slate-200">{detail.value}</dd>
    </div>
  );
}

function signalDetails(
  signal: RenderSignal,
  cardStatus: CardStatus,
  editableSignal: ApiSignal | null,
  source: string,
): Detail[] {
  const details: Detail[] = [
    { label: 'Source', value: source },
    {
      label: 'Last updated',
      value: signal.status.last_ok_at ? relativeTime(signal.status.last_ok_at) : 'never',
    },
    { label: 'Status', value: statusLabel(cardStatus) },
  ];
  if (editableSignal) {
    details.push(
      { label: 'Refresh', value: refreshLabel(editableSignal.refresh_seconds) },
      { label: 'Visibility', value: visibilityLabel(editableSignal.visibility) },
    );
  }
  return details;
}

function refreshLabel(seconds: number): string {
  if (seconds < 120) return `Every ${String(seconds)}s`;
  if (seconds < 7_200) return `Every ${String(Math.round(seconds / 60))}m`;
  if (seconds < 172_800) return `Every ${String(Math.round(seconds / 3_600))}h`;
  return `Every ${String(Math.round(seconds / 86_400))}d`;
}

function statusLabel(cardStatus: CardStatus): string {
  if (cardStatus === 'setup') return 'Needs setup';
  return cardStatus.charAt(0).toUpperCase() + cardStatus.slice(1);
}

function visibilityLabel(visibility: ApiSignal['visibility']): string {
  return visibility.charAt(0).toUpperCase() + visibility.slice(1);
}
