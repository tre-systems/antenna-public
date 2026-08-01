import { describe, expect, it } from 'vitest';
import { collectionTemplates, templates } from './index';

describe('collectionTemplates', () => {
  it('defines the curated v1 collection template set', () => {
    expect(collectionTemplates.map((template) => template.id)).toEqual([
      'founder-morning',
      'ai-frontier-watch',
      'trader-morning',
      'ops-morning',
      'investor-watchlist',
      'local-living',
    ]);
    expect(collectionTemplates.every((template) => template.signals.length >= 3)).toBe(true);
  });

  it('only references registered connector templates with valid config', () => {
    const byId = new Map(templates.map((template) => [template.id, template]));

    for (const collectionTemplate of collectionTemplates) {
      for (const signal of collectionTemplate.signals) {
        const connectorTemplate = byId.get(signal.templateId);
        expect(connectorTemplate, `${collectionTemplate.id}:${signal.templateId}`).toBeDefined();
        expect(
          connectorTemplate?.configSchema.safeParse(signal.config).success,
          `${collectionTemplate.id}:${signal.templateId} config should match registry schema`,
        ).toBe(true);
      }
    }
  });

  it('uses one history signal per equity rather than grouped watchlists', () => {
    const marketTemplates = collectionTemplates.filter((template) =>
      ['trader-morning', 'investor-watchlist'].includes(template.id),
    );

    for (const template of marketTemplates) {
      expect(
        template.signals.some((signal) => (signal.templateId as string) === 'equity-watchlist'),
      ).toBe(false);
    }
  });
});
