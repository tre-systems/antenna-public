import type { SignalAlertRecord, NotificationPreferenceRecord } from '../../api';

export type ActivityState =
  | { readonly kind: 'loading' }
  | {
      readonly kind: 'ready';
      readonly preference: NotificationPreferenceRecord | null;
      readonly alerts: ReadonlyArray<SignalAlertRecord>;
    }
  | { readonly kind: 'error'; readonly message: string };

export type PreferencePatch = Pick<NotificationPreferenceRecord, 'enabled' | 'frequency'>;
