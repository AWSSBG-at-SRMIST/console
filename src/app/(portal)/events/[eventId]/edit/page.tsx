import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { db, TABLE, GetCommand } from '@/lib/dynamodb';
import { isPresidium } from '@/lib/permissions';
import type { Event } from '@/types';
import EventForm from '@/components/events/EventForm';

export default async function EditEventPage({ params }: { params: Promise<{ eventId: string }> }) {
  const user = await getCurrentUser();
  if (!user || !isPresidium(user)) {
    redirect('/events');
  }

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

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-widest text-white mb-1">Edit Event</h1>
          <p className="text-sm text-[#888] font-mono">{event.name}</p>
        </div>
        <EventForm initialEvent={event} />
      </div>
    );
  } catch (error) {
    console.error('Error loading event:', error);
    redirect('/events');
  }
}
