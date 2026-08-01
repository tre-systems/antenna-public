import { sourceLabelForTemplate, sourcePolicyForTemplate, templates } from '@antenna/registry';
import type { ProposedSignal, Visibility, planConfirmSignalPatchSchema } from '@antenna/shared';
import type { z } from 'zod';
import { canReadSignalWithSourcePolicy } from '../policy/source-access';
import { InvalidTemplateConfigError, validateTemplateConfig } from '../registry/config';

export type PlanConfirmSignalPatch = z.infer<typeof planConfirmSignalPatchSchema>;

export type MaterializeSignalsResult =
  | { readonly ok: true; readonly signals: ProposedSignal[] }
  | {
      readonly ok: false;
      readonly error: 'invalid_config' | 'unknown_template';
      readonly detail: string;
    };

export const materializeSignals = (
  proposedSignals: ReadonlyArray<ProposedSignal>,
  editedSignals: ReadonlyArray<PlanConfirmSignalPatch> | undefined,
): MaterializeSignalsResult => {
  const signals: ProposedSignal[] = [];
  for (const [index, proposed] of proposedSignals.entries()) {
    const result = sanitizeSignal(proposed, editedSignals?.[index]);
    if (!result.ok) return result;
    signals.push(result.signal);
  }
  return { ok: true, signals };
};

// Treat client edits as blank-filling patches over server registry metadata.
const sanitizeSignal = (
  proposed: ProposedSignal,
  edited: PlanConfirmSignalPatch | undefined,
):
  | { readonly ok: true; readonly signal: ProposedSignal }
  | Exclude<MaterializeSignalsResult, { readonly ok: true }> => {
  const template = templateById(proposed.template_id);
  if (!template) {
    return {
      ok: false,
      error: 'unknown_template',
      detail: `unknown template: ${proposed.template_id}`,
    };
  }

  const { config, missing } = applyEdits(proposed, edited);
  const validated = validateCompletedConfig(template, config, missing);
  if (!validated.ok) return validated;

  return {
    ok: true,
    signal: {
      template_id: template.id,
      display_name: template.displayName,
      config: validated.config,
      missing,
      refresh_seconds: template.defaultRefreshSeconds,
      rights_status: template.rightsStatus,
      source_label: sourceLabelForTemplate(template.id, template.displayName),
    },
  };
};

const validateCompletedConfig = (
  template: (typeof templates)[number],
  config: Record<string, unknown>,
  missing: ReadonlyArray<string>,
):
  | { readonly ok: true; readonly config: Record<string, unknown> }
  | Exclude<MaterializeSignalsResult, { readonly ok: true }> => {
  if (missing.length > 0) return { ok: true, config };
  try {
    return { ok: true, config: validateTemplateConfig(template, config) };
  } catch (caught) {
    if (caught instanceof InvalidTemplateConfigError) {
      return {
        ok: false,
        error: caught.code,
        detail: `${caught.templateId} ${caught.reason}`,
      };
    }
    throw caught;
  }
};

const applyEdits = (
  proposed: ProposedSignal,
  edited: PlanConfirmSignalPatch | undefined,
): { readonly config: Record<string, unknown>; readonly missing: string[] } => {
  const missing = new Set(proposed.missing);
  const config: Record<string, unknown> = { ...proposed.config };
  for (const key of proposed.missing) {
    const value = edited?.config?.[key];
    if (value !== undefined && value !== '') {
      config[key] = value;
      missing.delete(key);
    }
  }
  return { config, missing: [...missing] };
};

const templateById = (templateId: string): (typeof templates)[number] | undefined =>
  templates.find((template) => template.id === templateId);

// Keep exposure-ineligible signals private rather than dropping them.
export const visibilityForNewSignal = (
  templateId: string,
  collectionVisibility: Visibility,
): Visibility => {
  if (collectionVisibility === 'private') return collectionVisibility;

  const decision = canReadSignalWithSourcePolicy({
    collectionVisibility,
    signalVisibility: collectionVisibility,
    policy: sourcePolicyForTemplate(templateId),
    audience: collectionVisibility === 'public' ? 'public' : 'shared_link',
  });
  return decision.ok ? collectionVisibility : 'private';
};
