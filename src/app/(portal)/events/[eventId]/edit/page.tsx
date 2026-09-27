import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { db, TABLE, GetCommand } from '@/lib/dynamodb';
import { canManageEvents } from '@/lib/permissions';
import type { Event } from '@/types';
import EventForm from '@/components/events/EventForm';

export default async function EditEventPage({ params }: { params: Promise<{ eventId: string }> }) {
  const user = await getCurrentUser();
  if (!user || !canManageEvents(user)) {
    redirect('/dashboard');
  }

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold uppercase tracking-widest text-white mb-1">Edit Event</h1>
        <p className="text-sm text-[#888] font-mono">{event.name}</p>
      </div>
      <EventForm initialEvent={event} />
    </div>
  );
}
