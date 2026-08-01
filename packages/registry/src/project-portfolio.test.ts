import { describe, expect, it } from 'vitest';
import { projectPortfolioTemplate } from './project-portfolio';

const validConfig = {
  projects: 'app-one,app-two',
  account_id: 'a'.repeat(32),
  days: 30,
};

describe('projectPortfolioTemplate', () => {
  it('validates deployment-owned project identifiers', () => {
    expect(projectPortfolioTemplate.configSchema.safeParse(validConfig).success).toBe(true);
    expect(
      projectPortfolioTemplate.configSchema.safeParse({ ...validConfig, projects: '-invalid' })
        .success,
    ).toBe(false);
    expect(
      projectPortfolioTemplate.configSchema.safeParse({ ...validConfig, account_id: 'invalid' })
        .success,
    ).toBe(false);
  });
});
