import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { canManageEvents } from '@/lib/permissions';
import EventForm from '@/components/events/EventForm';

export default async function NewEventPage() {
  const user = await getCurrentUser();
  if (!user || !canManageEvents(user)) {
    redirect('/dashboard');
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold uppercase tracking-widest text-white mb-1">Create Event</h1>
        <p className="text-sm text-[#888] font-mono">Create a new AWSSBG event</p>
      </div>
      <EventForm />
    </div>
  );
}
