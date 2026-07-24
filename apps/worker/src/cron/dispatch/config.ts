import { parseJsonRecord } from '../../db/codecs';
import { validateTemplateConfig } from '../../registry/config';
import type { SignalRow, DispatchEnv, DispatchTemplate } from './types';

type ConfigResult = { ok: true; config: Record<string, unknown> } | { ok: false; message: string };

const GITHUB_TOKEN_TEMPLATE_IDS = new Set([
  'github-repo-activity',
  'github-security-advisories',
  'github-trending',
]);

export const prepareAdapterConfig = (
  _client: unknown,
  env: DispatchEnv,
  signal: SignalRow,
  template: DispatchTemplate,
): ConfigResult => {
  const parsedConfig = parseJsonRecord(signal.config);
  const withGithubToken = injectGithubToken(env, template.id, parsedConfig);
  const withSecret = injectServerSecret(env, template, withGithubToken);
  if (!withSecret.ok) return withSecret;
  return { ok: true, config: validateTemplateConfig(template, withSecret.config) };
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
