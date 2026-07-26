import { describe, expect, it } from 'vitest';
import { appUsageTemplate } from './app-usage';

const anyHintMatches = (prompt: string): boolean =>
  appUsageTemplate.matchHints.some((rx) => rx.test(prompt));

describe('appUsageTemplate.matchHints', () => {
  it.each([
    'app usage for antenna',
    'usage of swade-toolbox',
    'real users activity on my projects',
    'analytics engine events',
  ])('matches "%s"', (prompt) => {
    expect(anyHintMatches(prompt)).toBe(true);
  });

  it.each(['weather in London', 'track EUR/USD', 'github trending', 'token usage this month'])(
    'does not match "%s"',
    (prompt) => {
      expect(anyHintMatches(prompt)).toBe(false);
    },
  );
});

describe('appUsageTemplate.paramExtractors', () => {
  it('extracts the project slug from natural prompts', () => {
    expect(appUsageTemplate.paramExtractors.project?.('usage for swade-toolbox')).toBe(
      'swade-toolbox',
    );
    expect(appUsageTemplate.paramExtractors.project?.('app usage of Antenna')).toBe('antenna');
    expect(appUsageTemplate.paramExtractors.project?.('app usage')).toBeUndefined();
  });
});

describe('appUsageTemplate metadata', () => {
  it('stays private-cloud with a server-injected analytics token', () => {
    expect(appUsageTemplate.paramKeys).toEqual(['project', 'account_id']);
    expect(appUsageTemplate.rightsStatus).toBe('requires-auth');
    expect(appUsageTemplate.defaultRefreshSeconds).toBe(3_600);
    expect(appUsageTemplate.serverSecret?.env).toBe('CF_ANALYTICS_API_TOKEN');
    expect(appUsageTemplate.serverSecret?.configKey).toBe('apiToken');
  });

  it('accepts a valid config and rejects malformed identifiers', () => {
    const valid = appUsageTemplate.configSchema.safeParse({
      project: 'antenna',
      account_id: 'f'.repeat(32),
      days: 14,
    });
    expect(valid.success).toBe(true);

    const badProject = appUsageTemplate.configSchema.safeParse({
      project: 'Not A Slug',
      account_id: 'f'.repeat(32),
    });
    const badAccount = appUsageTemplate.configSchema.safeParse({
      project: 'antenna',
      account_id: 'short',
    });
    expect(badProject.success).toBe(false);
    expect(badAccount.success).toBe(false);
  });
});
