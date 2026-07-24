import { eq } from 'drizzle-orm';
import { recordStarterSignalDismissal } from '../../auth';
import { signalStatus, signals, signalPoints } from '../../db/schema';
import type { SignalRow, Client } from './types';

export const deleteOwnedSignal = async (client: Client, signal: SignalRow): Promise<void> => {
  // Explicit child deletes keep older local databases safe during migrations.
  await client.delete(signalPoints).where(eq(signalPoints.signalId, signal.id)).run();
  await client.delete(signalStatus).where(eq(signalStatus.signalId, signal.id)).run();
  await recordStarterSignalDismissal(client, signal.collectionId, signal);
  await client.delete(signals).where(eq(signals.id, signal.id)).run();
};
