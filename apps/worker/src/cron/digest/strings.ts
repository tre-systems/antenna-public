export const hasText = (value: string | undefined): value is string =>
  typeof value === 'string' && value.trim().length > 0;

export const safeResponseText = async (response: Response): Promise<string> => {
  const text = await response.text().catch(() => '');
  return text.slice(0, 300);
};
