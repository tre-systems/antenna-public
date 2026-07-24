export const discardResponse = async (response: Response): Promise<void> => {
  await response.body?.cancel().catch(() => undefined);
};
