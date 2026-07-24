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

export const validateTemplateConfig = (
  template: TemplateWithConfigSchema,
  config: Record<string, unknown>,
): Record<string, unknown> => {
  const parsed = template.configSchema.safeParse(config);
  if (!parsed.success) {
    throw new Error(`invalid_config: ${template.id} config does not match registry schema`);
  }
  if (!parsed.data || typeof parsed.data !== 'object' || Array.isArray(parsed.data)) {
    throw new Error(`invalid_config: ${template.id} config must be an object`);
  }
  return parsed.data as Record<string, unknown>;
};
