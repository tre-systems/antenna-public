import type { Adapter, SignalConfig, DataPoint } from '@antenna/connectors';
import type { z } from 'zod';
import type { SourceRightsStatus } from './source-policy';

export interface AlertRuleInput {
  readonly latest: DataPoint;
  readonly previous: DataPoint;
  readonly latestValue: number;
  readonly previousValue: number;
}

export interface AlertRule {
  readonly id: string;
  readonly label: string;
  readonly condition: (input: AlertRuleInput) => boolean;
}

export interface ConnectorTemplate<C extends SignalConfig = SignalConfig> {
  id: string;
  displayName: string;
  configSchema: z.ZodType;
  paramKeys: readonly string[];
  matchHints: RegExp[];
  paramExtractors: Record<string, (prompt: string) => string | undefined>;
  plannerEnabled?: boolean;
  rightsStatus: SourceRightsStatus;
  defaultRefreshSeconds: number;
  // Omitted templates fall back to the Worker's conservative 180-day default.
  pointRetentionDays?: number;
  retainRawPayload?: boolean;
  serverSecret?: {
    readonly env: string;
    readonly configKey: string;
    readonly setupMessage: string;
  };
  alertRules?: readonly AlertRule[];
  adapter: Adapter<C>;
}

export interface CollectionTemplateSignalSpec {
  readonly templateId: string;
  readonly title: string;
  readonly config: SignalConfig;
  readonly refreshSeconds?: number;
}

export interface CollectionTemplate {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly summary: string;
  readonly signals: readonly CollectionTemplateSignalSpec[];
}
