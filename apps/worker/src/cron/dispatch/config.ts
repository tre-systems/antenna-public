import { parseJsonRecord } from '../../db/codecs';
import { isAdminUser } from '../../policy/admin';
import { validateTemplateConfig } from '../../registry/config';
import { readDeploymentStats } from '../../routes/deployment-stats';
import type { Client, CollectionRow, SignalRow, DispatchEnv, DispatchTemplate } from './types';

type ConfigResult = { ok: true; config: Record<string, unknown> } | { ok: false; message: string };

const GITHUB_TOKEN_TEMPLATE_IDS = new Set([
  'github-repo-activity',
  'github-security-advisories',
  'github-trending',
]);

const DEPLOYMENT_STATS_TEMPLATE_ID = 'antenna-users';

export const prepareAdapterConfig = async (
  client: Client,
  env: DispatchEnv,
  signal: SignalRow,
  collection: CollectionRow,
  template: DispatchTemplate,
): Promise<ConfigResult> => {
  const parsedConfig = parseJsonRecord(signal.config);
  const withGithubToken = injectGithubToken(env, template.id, parsedConfig);
  const withSecret = injectServerSecret(env, template, withGithubToken);
  if (!withSecret.ok) return withSecret;
  const withStats = await injectDeploymentStats(client, env, template.id, collection, withSecret);
  if (!withStats.ok) return withStats;
  return { ok: true, config: validateTemplateConfig(template, withStats.config) };
};

// Materialise deployment counts only for an admin-owned collection.
const injectDeploymentStats = async (
  client: Client,
  env: DispatchEnv,
  templateId: string,
  collection: CollectionRow,
  previous: { readonly config: Record<string, unknown> },
): Promise<ConfigResult> => {
  if (templateId !== DEPLOYMENT_STATS_TEMPLATE_ID) return { ok: true, config: previous.config };
  if (!(await isAdminUser(client, env, collection.ownerId))) {
    return {
      ok: false,
      message: 'setup_required: deployment user counts are available to deployment admins only',
    };
  }
  return { ok: true, config: { ...previous.config, ...(await readDeploymentStats(client)) } };
};

const injectGithubToken = (
  env: DispatchEnv,
  templateId: string,
  config: Record<string, unknown>,
): Record<string, unknown> => {
  if (!GITHUB_TOKEN_TEMPLATE_IDS.has(templateId)) return config;
  if (typeof env.GITHUB_TOKEN !== 'string' || env.GITHUB_TOKEN.trim().length === 0) return config;
  return { ...config, githubToken: env.GITHUB_TOKEN };
};

const injectServerSecret = (
  env: DispatchEnv,
  template: DispatchTemplate,
  config: Record<string, unknown>,
): ConfigResult => {
  const secret = template.serverSecret;
  if (!secret) return { ok: true, config };
  const value = env[secret.env as keyof DispatchEnv];
  if (typeof value !== 'string' || value.trim().length === 0) {
    return { ok: false, message: `setup_required: ${secret.setupMessage}` };
  }
  return { ok: true, config: { ...config, [secret.configKey]: value } };
};
