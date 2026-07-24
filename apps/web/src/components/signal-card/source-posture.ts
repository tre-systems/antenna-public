import type { ApiSignal } from '../../api';
import type { SourcePosture } from './types';

const SOURCE_POSTURE_STYLES: Record<SourcePosture['value'], string> = {
  public:
    'bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/20',
  blocked:
    'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-white/5 dark:text-slate-300 dark:ring-white/10',
  unknown:
    'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/20',
};

export function sourcePosture(signal: ApiSignal): SourcePosture {
  const policy = signal.source_policy;
  if (!policy) {
    return {
      label: 'source review',
      title: 'No source-policy metadata was returned for this signal.',
      tone: SOURCE_POSTURE_STYLES.unknown,
      value: 'unknown',
    };
  }
  if (policy.public_display_eligible) {
    return {
      label: 'Shareable',
      title: `${policy.label} can be shown publicly with source attribution.`,
      tone: SOURCE_POSTURE_STYLES.public,
      value: 'public',
    };
  }
  return {
    label: 'Private source',
    title: policy.public_display_blocker ?? `${policy.label} cannot be shown publicly yet.`,
    tone: SOURCE_POSTURE_STYLES.blocked,
    value: 'blocked',
  };
}
