// Best-effort notifier: hands an event to the per-collection DO so connected
// browsers can refetch. Never throws — a failed notify must not derail the
// cron tick or the surrounding DB write.

export type NotifyEnv = {
  readonly CHANNELS?: DurableObjectNamespace;
};

export type CollectionEvent = Readonly<{
  type: string;
  // Free-form payload; the SPA currently only triggers a refetch on receipt.
  [key: string]: unknown;
}>;

export const notifyCollection = async (
  env: NotifyEnv,
  collectionId: string,
  event: CollectionEvent,
): Promise<void> => {
  const channels = env.CHANNELS;
  if (!channels) return; // local-dev / test env may not bind the DO.
  try {
    const id = channels.idFromName(collectionId);
    const stub = channels.get(id);
    const response = await stub.fetch('https://do/notify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(event),
    });
    await response.arrayBuffer();
  } catch {
    // Notify is fire-and-forget; the next 30s SPA fallback poll catches up.
  }
};
