import { signal } from '@preact/signals';
import type { ConnectorRequestRecord, PlanRecord } from '@antenna/shared';

export const currentPlan = signal<PlanRecord | null>(null);
export const planError = signal<string | null>(null);
export const planSubmitting = signal<boolean>(false);
export const connectorRequests = signal<ConnectorRequestRecord[]>([]);

export function clearPlan(): void {
  currentPlan.value = null;
  planError.value = null;
}
