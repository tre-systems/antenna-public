import { sourceLabelForTemplate } from '@antenna/registry';

export const sourceLabelFor = (templateId: string, fallback: string): string =>
  sourceLabelForTemplate(templateId, fallback);
