import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { db, TABLE, ScanCommand } from '@/lib/dynamodb';
import { canManageEvents } from '@/lib/permissions';
import type { Event } from '@/types';
import EventsListClient from '@/components/events/EventsListClient';

export default async function EventsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!canManageEvents(user)) redirect('/dashboard');

  let events: Event[] = [];
  try {
    const result = await db.send(new ScanCommand({ TableName: TABLE.EVENTS }));
    events = ((result.Items || []) as Event[])
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch (error) {
    console.error('Error loading events:', error);
  }

  return <EventsListClient events={events} canCreate canManageEvents />;
}
