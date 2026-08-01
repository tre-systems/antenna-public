import { describe, expect, it } from 'vitest';
import { appHealthTemplate } from './app-health';

describe('appHealthTemplate', () => {
  it('keeps endpoint authority in a server-owned manifest', () => {
    expect(appHealthTemplate.plannerEnabled).toBe(false);
    expect(appHealthTemplate.matchHints.some((hint) => hint.test('app health'))).toBe(true);
    expect(appHealthTemplate.paramKeys).toEqual(['projects']);
    expect(appHealthTemplate.serverSecret).toMatchObject({
      env: 'APP_HEALTH_MANIFEST',
      configKey: 'manifest',
    });
    expect(appHealthTemplate.configSchema.safeParse({ projects: 'app-one,app-two' }).success).toBe(
      true,
    );
    expect(
      appHealthTemplate.configSchema.safeParse({ projects: 'acto', url: 'https://evil.test' })
        .success,
    ).toBe(true);
    expect(appHealthTemplate.configSchema.safeParse({ projects: '-invalid' }).success).toBe(false);
  });
});
