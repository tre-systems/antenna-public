export type SignalConfig = Record<string, unknown>;

export interface DataPoint {
  dimensions: Record<string, string | number>;
  value: number | string;
  unit?: string;
  ts: number;
  sourceUrl?: string;
}

export type AdapterError = {
  code: 'fetch_failed' | 'parse_failed' | 'rate_limited' | 'unauthorized' | 'unknown';
  message: string;
  retryAfterSeconds?: number;
};

export type AdapterResult =
  // A warning preserves partial observations without claiming a complete successful check.
  | { ok: true; points: DataPoint[]; rawPayload: unknown; warning?: AdapterError }
  | { ok: false; error: AdapterError };

export type Adapter<C extends SignalConfig = SignalConfig> = (config: C) => Promise<AdapterResult>;
