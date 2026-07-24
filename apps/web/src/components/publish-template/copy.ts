import type { CollectionRecord } from '../../api';

export const publishTemplateErrorMessage = (err: unknown): string => {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes('collection_not_public')) {
    return 'Make the collection public before publishing it as a template.';
  }
  if (message.includes('no_template_signals')) {
    return 'No shareable signals can be published yet. Mark eligible signals public first.';
  }
  if (message.includes('not_found')) return 'This collection could not be found.';
  return 'Could not publish this template. Try again after checking the public signal list.';
};

export const defaultSummary = (collection: CollectionRecord): string =>
  collection.description?.trim() || `Reusable public signals from ${collection.title}`;

export const humanSkippedReason = (reason: string): string => {
  if (reason === 'source_not_public_display_eligible') return 'source policy signals public reuse';
  if (reason === 'signal_not_public') return 'signal visibility is not public';
  return reason.replaceAll('_', ' ');
};
