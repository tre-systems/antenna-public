import { eq, inArray } from 'drizzle-orm';
import {
  signalAlerts,
  signalStatus,
  connectorRequests,
  collectionPlans,
  collectionTemplatePublications,
  collections,
  signals,
  signalPoints,
  dismissedStarterSignals,
  notificationDeliveries,
  notificationPrefs,
  publicCollectionReports,
  userCollectionVisits,
} from '../../db/schema';
import type { Client } from './types';

export const deleteCollectionTree = async (client: Client, collectionId: string): Promise<void> => {
  const signalRows = await client
    .select({ id: signals.id })
    .from(signals)
    .where(eq(signals.collectionId, collectionId))
    .all();
  await deleteSignalChildren(
    client,
    signalRows.map((signal) => signal.id),
  );
  await deleteCollectionChildren(client, collectionId);
  await client.delete(collections).where(eq(collections.id, collectionId)).run();
};

const deleteSignalChildren = async (
  client: Client,
  signalIds: ReadonlyArray<string>,
): Promise<void> => {
  if (signalIds.length === 0) return;
  await client
    .delete(signalAlerts)
    .where(inArray(signalAlerts.signalId, [...signalIds]))
    .run();
  await client
    .delete(signalPoints)
    .where(inArray(signalPoints.signalId, [...signalIds]))
    .run();
  await client
    .delete(signalStatus)
    .where(inArray(signalStatus.signalId, [...signalIds]))
    .run();
};

const deleteCollectionChildren = async (client: Client, collectionId: string): Promise<void> => {
  await client.delete(signals).where(eq(signals.collectionId, collectionId)).run();
  await client
    .delete(dismissedStarterSignals)
    .where(eq(dismissedStarterSignals.collectionId, collectionId))
    .run();
  await client
    .delete(connectorRequests)
    .where(eq(connectorRequests.collectionId, collectionId))
    .run();
  await client.delete(collectionPlans).where(eq(collectionPlans.collectionId, collectionId)).run();
  await client
    .delete(userCollectionVisits)
    .where(eq(userCollectionVisits.collectionId, collectionId))
    .run();
  await client
    .delete(collectionTemplatePublications)
    .where(eq(collectionTemplatePublications.collectionId, collectionId))
    .run();
  await client
    .delete(publicCollectionReports)
    .where(eq(publicCollectionReports.collectionId, collectionId))
    .run();
  await client
    .delete(notificationPrefs)
    .where(eq(notificationPrefs.collectionId, collectionId))
    .run();
  await client
    .delete(notificationDeliveries)
    .where(eq(notificationDeliveries.collectionId, collectionId))
    .run();
};
