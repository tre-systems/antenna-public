import type { z } from 'zod';
import type {
  rightsStatusSchema,
  sourceAcquisitionStateSchema,
  sourceAcquisitionStrategySchema,
  sourceBlockerReasonSchema,
  visibilitySchema,
} from './zod-schemas';

export type RightsStatus = z.infer<typeof rightsStatusSchema>;
export type Visibility = z.infer<typeof visibilitySchema>;
export type SourceBlockerReason = z.infer<typeof sourceBlockerReasonSchema>;
export type SourceAcquisitionState = z.infer<typeof sourceAcquisitionStateSchema>;
export type SourceAcquisitionStrategy = z.infer<typeof sourceAcquisitionStrategySchema>;
export type SignalStatusValue = 'live' | 'stale' | 'error' | 'loading';

export type RightsStatusCopy = {
  readonly label: string;
  readonly tooltip: string;
};

export const RIGHTS_STATUS_COPY: Record<RightsStatus, RightsStatusCopy> = {
  public: {
    label: 'Public source',
    tooltip: 'Public data — sharing still follows the source display policy.',
  },
  'with-attribution': {
    label: 'Public · attribution',
    tooltip: 'Public data — keep the source label and link when sharing is permitted.',
  },
  'requires-auth': {
    label: 'Requires sign-in',
    tooltip: 'Needs a connected account; values stay private to you.',
  },
  'needs-review': {
    label: 'Needs review',
    tooltip: 'Source rights or execution mode need review before this can be added.',
  },
};
