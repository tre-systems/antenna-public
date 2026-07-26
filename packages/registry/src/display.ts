import { sourcePolicyForTemplate } from './source-policy';
import { macroPreset } from './display-macro';
import { displayTitle, templateSourceUrl } from './display-template';
import {
  pointLabel,
  pointSourceUrl,
  type RegistryPointDisplay,
  type RegistryPointInput,
} from './display-point';

export type { RegistryPointDisplay, RegistryPointInput } from './display-point';

export type RegistryDisplay = {
  readonly title: string;
  readonly sourceLabel: string;
  readonly sourceUrl: string | null;
};

export const resolveTemplateDisplay = (
  templateId: string,
  fallbackTitle: string,
  config: Readonly<Record<string, unknown>>,
  pointSourceUrls: ReadonlyArray<string | null | undefined> = [],
): RegistryDisplay => {
  const policy = sourcePolicyForTemplate(templateId);
  const preset = macroPreset(templateId, config);
  return {
    title: displayTitle(templateId, fallbackTitle, config),
    sourceLabel: preset?.sourceLabel ?? policy?.label ?? templateId,
    sourceUrl: templateSourceUrl(templateId, config, pointSourceUrls, preset),
  };
};

export const resolvePointDisplay = (
  templateId: string,
  point: RegistryPointInput,
): RegistryPointDisplay => ({
  label: pointLabel(point),
  sourceUrl: pointSourceUrl(templateId, point),
});
