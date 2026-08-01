import { signal } from '@preact/signals';
import type { ConnectorRequestRecord, PlanRecord } from '@antenna/shared';

export const currentPlan = signal<PlanRecord | null>(null);
export const planError = signal<string | null>(null);
export const planSubmitting = signal<boolean>(false);
export const connectorRequests = signal<ConnectorRequestRecord[]>([]);
let stateVersion = 0;

export function clearPlan(): void {
  currentPlan.value = null;
  planError.value = null;
}

export function resetPlanState(): void {
  stateVersion += 1;
  clearPlan();
  planSubmitting.value = false;
  connectorRequests.value = [];
}

export function planStateVersion(): number {
  return stateVersion;
}

export function isCurrentPlanState(version: number): boolean {
  return version === stateVersion;
}
