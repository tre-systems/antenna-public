type TemplateWithConfigSchema = {
  readonly id: string;
  readonly configSchema: {
    safeParse: (
      input: unknown,
    ) =>
      | { readonly success: true; readonly data: unknown }
      | { readonly success: false; readonly error: { readonly issues: ReadonlyArray<unknown> } };
  };
};

export class InvalidTemplateConfigError extends Error {
  readonly code = 'invalid_config';

  constructor(
    readonly templateId: string,
    readonly reason: string,
  ) {
    super(`invalid_config: ${templateId} ${reason}`);
    this.name = 'InvalidTemplateConfigError';
  }
}

export const validateTemplateConfig = (
  template: TemplateWithConfigSchema,
  config: Record<string, unknown>,
): Record<string, unknown> => {
  const parsed = template.configSchema.safeParse(config);
  if (!parsed.success) {
    throw new InvalidTemplateConfigError(template.id, 'config does not match registry schema');
  }
  if (!parsed.data || typeof parsed.data !== 'object' || Array.isArray(parsed.data)) {
    throw new InvalidTemplateConfigError(template.id, 'config must be an object');
  }
  return parsed.data as Record<string, unknown>;
};
