import { templates } from '@antenna/registry';
import { isAdminEmail, type AdminEnv } from './admin';

export const isDeploymentTemplate = (templateId: string): boolean =>
  templates.some((template) => template.id === templateId && template.deploymentAdminOnly);

export const canReadDeploymentTemplate = (
  env: AdminEnv,
  email: string,
  templateId: string,
): boolean => !isDeploymentTemplate(templateId) || isAdminEmail(env, email);
