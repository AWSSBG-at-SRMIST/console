import { getCurrentUser } from '@/lib/auth';
import { db, TABLE, ScanCommand } from '@/lib/dynamodb';
import { isPresidium } from '@/lib/permissions';
import type { Event } from '@/types';
import EventsListClient from '@/components/events/EventsListClient';

export default async function EventsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  try {
    const result = await db.send(new ScanCommand({ TableName: TABLE.EVENTS }));
    let events = (result.Items || []) as Event[];

    // Presidium sees all events; others see published/live/completed only
    if (!isPresidium(user)) {
      events = events.filter(e => ['PUBLISHED', 'LIVE', 'COMPLETED'].includes(e.status));
    }

    // Sort by date descending
    events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return <EventsListClient events={events} canCreate={isPresidium(user)} isPresidium={isPresidium(user)} />;
  } catch (error) {
    console.error('Error loading events:', error);
    return <EventsListClient events={[]} canCreate={isPresidium(user)} isPresidium={isPresidium(user)} />;
  }
}
