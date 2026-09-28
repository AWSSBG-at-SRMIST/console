import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { db, TABLE, GetCommand } from '@/lib/dynamodb';
import { canManageEvents } from '@/lib/permissions';
import type { Event } from '@/types';
import EventDetailClient from '@/components/events/EventDetailClient';

export default async function EventDetailPage({ params }: { params: Promise<{ eventId: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!canManageEvents(user)) redirect('/dashboard');

  const { eventId } = await params;

  let event: Event | null = null;
  try {
    const result = await db.send(new GetCommand({
      TableName: TABLE.EVENTS,
      Key: { eventId },
    }));
    event = (result.Item as Event | undefined) ?? null;
  } catch (error) {
    console.error('Error loading event:', error);
    redirect('/events');
  }

  if (!event) redirect('/events');

  return <EventDetailClient event={event} canEdit />;
}
