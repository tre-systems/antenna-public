import { resolvePointDisplay, resolveTemplateDisplay } from '@antenna/registry/src/display';
import type { DataPoint } from '../api';
import { configOf } from './common';
import type { RenderSignal } from './types';

export const safeExternalUrl = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password ? trimmed : null;
  } catch {
    return null;
  }
};

export function signalTitle(signal: RenderSignal): string {
  if (signal.display?.title) return signal.display.title;
  return registrySignalDisplay(signal).title;
}

export function signalSourceLabel(signal: RenderSignal): string {
  if (signal.display?.source_label) return signal.display.source_label;
  return registrySignalDisplay(signal).sourceLabel;
}

export function signalSourceUrl(signal: RenderSignal): string | null {
  return safeExternalUrl(signal.display?.source_url) ?? registrySignalDisplay(signal).sourceUrl;
}

export function pointSourceUrl(point: DataPoint, signal: RenderSignal): string | null {
  const supplied = safeExternalUrl(point.display?.source_url);
  if (supplied) return supplied;
  return registryPointDisplay(signal.template_id, point).sourceUrl;
}

const registrySignalDisplay = (signal: RenderSignal) =>
  resolveTemplateDisplay(
    signal.template_id,
    signal.title ?? signal.template_id,
    configOf(signal),
    signal.points.map((point) => point.display?.source_url ?? point.source_url),
  );

const registryPointDisplay = (templateId: string, point: DataPoint) =>
  resolvePointDisplay(templateId, {
    dimensions: point.dimensions,
    valueText: point.value_text,
    sourceUrl: point.source_url,
  });
