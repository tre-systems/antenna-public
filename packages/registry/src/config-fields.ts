import type { SignalConfig } from '@antenna/connectors';

// Stored signal configs are unknown-valued records; adapters want concrete types.

export const stringField = (config: SignalConfig, key: string): string => {
  const value = config[key];
  return typeof value === 'string' ? value : '';
};

export const nonEmptyStringField = (config: SignalConfig, key: string): string | undefined => {
  const value = config[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
};

export const numberField = (config: SignalConfig, key: string): number | undefined => {
  const value = config[key];
  return typeof value === 'number' ? value : undefined;
};
