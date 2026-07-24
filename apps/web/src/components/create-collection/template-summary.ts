import type { CollectionTemplateRecord } from '../../api';

export const templateSignalSummary = (template: CollectionTemplateRecord): string => {
  const names = template.signals.slice(0, 3).map((signal) => signal.title);
  const remaining = template.signals.length - names.length;
  const prefix = `${template.signals.length} ${template.signals.length === 1 ? 'signal' : 'signals'}`;
  if (names.length === 0) return prefix;
  return `${prefix}: ${names.join(', ')}${remaining > 0 ? `, +${remaining} more` : ''}`;
};
