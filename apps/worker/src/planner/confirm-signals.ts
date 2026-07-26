import { sourceLabelForTemplate, sourcePolicyForTemplate, templates } from '@antenna/registry';
import type { ProposedSignal, Visibility, planConfirmSignalPatchSchema } from '@antenna/shared';
import type { z } from 'zod';
import { canReadSignalWithSourcePolicy } from '../policy/source-access';
import { validateTemplateConfig } from '../registry/config';

export type PlanConfirmSignalPatch = z.infer<typeof planConfirmSignalPatchSchema>;

export const materializeSignals = (
  proposedSignals: ReadonlyArray<ProposedSignal>,
  editedSignals: ReadonlyArray<PlanConfirmSignalPatch> | undefined,
): ProposedSignal[] =>
  proposedSignals.map((proposed, index) => sanitizeSignal(proposed, editedSignals?.[index]));

// Client edits only fill blanks: template identity, refresh cadence, rights, and
// source label are re-resolved from the registry regardless of what was sent.
const sanitizeSignal = (
  proposed: ProposedSignal,
  edited: PlanConfirmSignalPatch | undefined,
): ProposedSignal => {
  const template = templateById(proposed.template_id);
  if (!template) throw new Error(`unknown template: ${proposed.template_id}`);

  const { config, missing } = applyEdits(proposed, edited);
  const validated = missing.length === 0 ? validateTemplateConfig(template, config) : config;

  return {
    template_id: template.id,
    display_name: template.displayName,
    config: validated,
    missing,
    refresh_seconds: template.defaultRefreshSeconds,
    rights_status: template.rightsStatus,
    source_label: sourceLabelForTemplate(template.id, template.displayName),
  };
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

// A source that cannot be exposed through the collection's shared/public surface
// still belongs in the collection — it just stays private, and the external read
// routes filter on signal visibility. Elevating it later goes through the update
// route, which re-checks this policy.
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
