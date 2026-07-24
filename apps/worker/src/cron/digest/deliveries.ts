import { eq } from 'drizzle-orm';
import { notificationDeliveries } from '../../db/schema';
import { CHANNEL } from './constants';
import type { Client, DeliveryRecord } from './types';

type NotificationDeliveryInsert = typeof notificationDeliveries.$inferInsert;

export const deliveryExists = async (client: Client, id: string): Promise<boolean> => {
  const [existing] = await client
    .select({ id: notificationDeliveries.id })
    .from(notificationDeliveries)
    .where(eq(notificationDeliveries.id, id))
    .limit(1)
    .all();
  return existing !== undefined;
};

export const recordDelivery = (client: Client, delivery: DeliveryRecord): Promise<unknown> =>
  client
    .insert(notificationDeliveries)
    .values(deliveryValues(delivery))
    .onConflictDoNothing()
    .run();

export const deliveryId = (userId: string, collectionId: string, day: string): string =>
  `${userId}:${collectionId}:${CHANNEL}:${day}`;

const deliveryValues = (delivery: DeliveryRecord): NotificationDeliveryInsert => ({
  id: delivery.id,
  userId: delivery.userId,
  collectionId: delivery.collectionId,
  channel: CHANNEL,
  periodStart: delivery.periodStart,
  periodEnd: delivery.periodEnd,
  sentAt: delivery.status === 'sent' ? delivery.sentAt : null,
  status: delivery.status,
  error: delivery.error,
});
