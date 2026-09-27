import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { db, TABLE, GetCommand } from '@/lib/dynamodb';
import { isPresidium } from '@/lib/permissions';
import type { Event } from '@/types';
import EventDetailClient from '@/components/events/EventDetailClient';

export default async function EventDetailPage({ params }: { params: Promise<{ eventId: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const { eventId } = await params;

  try {
    const result = await db.send(new GetCommand({
      TableName: TABLE.EVENTS,
      Key: { eventId },
    }));

    if (!result.Item) {
      redirect('/events');
    }

    const event = result.Item as Event;

    // Access control: Presidium sees all, others see published/live/completed
    if (!isPresidium(user)) {
      if (!['PUBLISHED', 'LIVE', 'COMPLETED'].includes(event.status)) {
        redirect('/events');
      }
    }

    return <EventDetailClient event={event} canEdit={isPresidium(user)} />;
  } catch (error) {
    console.error('Error loading event:', error);
    redirect('/events');
  }
}
