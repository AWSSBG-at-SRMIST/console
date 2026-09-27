'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Edit2, Trash2, Calendar, Clock, MapPin, Globe, Link2, Users, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { MeetupLogo } from '@/components/events/MeetupLogo';
import { EventBannerImage } from '@/components/events/EventBannerImage';
import { isEventDateSet } from '@/lib/events';
import type { Event, EventStatus } from '@/types';

const STATUS_COLORS: Record<EventStatus, string> = {
  DRAFT: 'bg-gray-600',
  PUBLISHED: 'bg-blue-600',
  LIVE: 'bg-green-600',
  COMPLETED: 'bg-purple-600',
  CANCELLED: 'bg-red-600',
  ARCHIVED: 'bg-gray-500',
};

interface EventDetailClientProps {
  event: Event;
  canEdit: boolean;
}

export default function EventDetailClient({ event, canEdit }: EventDetailClientProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [bannerFailed, setBannerFailed] = useState(false);
  const bannerSrc = event.banner || event.bannerImageUrl || '';

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${event.name}"? This action cannot be undone.`)) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/events/${event.eventId}`, { method: 'DELETE' });
      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || 'Failed to delete event');
        return;
      }

      toast.success('Event deleted successfully');
      router.push('/events');
      router.refresh();
    } catch (err) {
      console.error('Delete error:', err);
      toast.error('An error occurred while deleting the event');
    } finally {
      setIsDeleting(false);
    }
  };

  // Format date range display
  const formatDateRange = (): string => {
    if (!isEventDateSet(event.date)) return 'Date TBD';
    const startDate = new Date(event.date);
    const endDate = event.endDate ? new Date(event.endDate) : null;

    if (!endDate || event.date === event.endDate) {
      // Single day
      return startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } else {
      // Multi-day
      const sameMonth = startDate.getMonth() === endDate.getMonth();
      const sameYear = startDate.getFullYear() === endDate.getFullYear();
      
      if (sameMonth && sameYear) {
        return `${startDate.getDate()} – ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      } else if (sameYear) {
        return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      } else {
        return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} – ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <Link href="/events">
          <Button variant="outline" size="sm" className="gap-2">
            <ArrowLeft size={16} />
            Back to Events
          </Button>
        </Link>
        {(event.meetupLink || canEdit) && (
          <div className="flex items-center gap-2">
            {event.meetupLink && (
              <Button asChild variant="outline" size="sm" className="gap-2">
                <a
                  href={event.meetupLink}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MeetupLogo size={14} className="text-[#ED1C40]" />
                  View on Meetup
                </a>
              </Button>
            )}
            {canEdit && (
              <>
                <Button asChild size="sm" className="gap-2">
                  <Link href={`/events/${event.eventId}/edit`}>
                    <Edit2 size={16} />
                    Edit
                  </Link>
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={isDeleting}
                  onClick={handleDelete}
                  className="gap-2"
                >
                  <Trash2 size={16} />
                  Delete
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Event Card */}
      <div className="border-2 border-[#2d2d2d] rounded-lg overflow-hidden">
        {/* Banner */}
        {bannerSrc ? (
          <div className="relative w-full h-64 bg-[#1a1a1a] overflow-hidden border-b-2 border-[#2d2d2d]">
            {bannerFailed ? (
              <div className="w-full h-full flex items-center justify-center">
                <p className="text-xs text-[#888] font-mono">Banner unavailable</p>
              </div>
            ) : (
              <EventBannerImage
                url={bannerSrc}
                alt={event.name}
                width={1200}
                className="w-full h-full object-cover"
                onError={() => setBannerFailed(true)}
              />
            )}
            {event.meetupLink && (
              <a
                href={event.meetupLink}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="View on Meetup"
                title="View on Meetup"
                className="absolute top-3 right-3 z-2 flex h-10 w-10 items-center justify-center rounded-full bg-[#ED1C40] text-white shadow-md hover:scale-105 transition-transform"
              >
                <MeetupLogo size={20} />
              </a>
            )}
          </div>
        ) : null}

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Title & Status */}
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold uppercase tracking-widest">{event.name}</h1>
              <Badge className={cn('text-white text-sm font-bold uppercase px-3 py-1', STATUS_COLORS[event.status])}>
                {event.status.charAt(0) + event.status.slice(1).toLowerCase()}
              </Badge>
            </div>
            {event.eventType && (
              <p className="text-sm text-[#888] font-mono">Type: {event.eventType === 'OTHER' ? event.customEventType : event.eventType}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-[#f0f0f0] mb-2">Description</h2>
            <p className="text-sm text-[#bbb] whitespace-pre-wrap">{event.description}</p>
          </div>

          {/* Event Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t-2 border-b-2 border-[#2d2d2d] py-4 space-y-4">
            <div className="flex gap-3">
              <Calendar size={16} className="text-[#FF9900] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#888] mb-1">Date</p>
                <p className="text-base font-mono text-white">{formatDateRange()}</p>
              </div>
            </div>

            <div className="flex gap-3">
              <Clock size={16} className="text-[#FF9900] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#888] mb-1">Time</p>
                <p className="text-base font-mono text-white">{event.startTime} – {event.endTime}</p>
              </div>
            </div>

            {event.eventMode && (
              <div className="flex gap-3">
                {event.eventMode === 'ONLINE' || event.eventMode === 'HYBRID' ? (
                  <>
                    <Globe size={16} className="text-[#FF9900] flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-[#888] mb-1">Mode</p>
                      <p className="text-base font-mono text-white">{event.eventMode}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <MapPin size={16} className="text-[#FF9900] flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-[#888] mb-1">Mode</p>
                      <p className="text-base font-mono text-white">{event.eventMode}</p>
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <MapPin size={16} className="text-[#FF9900] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#888] mb-1">Venue</p>
                <p className="text-base font-mono text-white">{event.venue}</p>
              </div>
            </div>

            {event.meetingLink && (
              <div className="flex gap-3">
                <Link2 size={16} className="text-[#FF9900] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-[#888] mb-1">Meeting Link</p>
                  <a
                    href={event.meetingLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-base font-mono text-[#FF9900] hover:underline break-all"
                  >
                    Join Meeting
                  </a>
                </div>
              </div>
            )}

            {event.meetupLink && (
              <div className="flex gap-3">
                <MeetupLogo size={16} className="text-[#ED1C40] shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-[#888] mb-1">Meetup</p>
                  <a
                    href={event.meetupLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-base font-mono text-[#FF9900] hover:underline inline-flex items-center gap-2"
                  >
                    View on Meetup
                    <ExternalLink size={14} />
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Registration Info */}
          {event.registrationRequired && (
            <div className="bg-[#1a1a1a] border-2 border-[#2d2d2d] p-4 rounded">
              <div className="flex gap-2 mb-3">
                <Users size={16} className="text-[#FF9900] flex-shrink-0" />
                <h3 className="text-xs font-bold uppercase tracking-widest text-[#888]">Registration</h3>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-[#888] mb-1">Deadline</p>
                  <p className="text-[#bbb]">{event.registrationDeadline}</p>
                </div>
                {event.participantCapacity && (
                  <div>
                    <p className="text-[#888] mb-1">Capacity</p>
                    <p className="text-[#bbb]">{event.participantCapacity} participants</p>
                  </div>
                )}
                <div className="col-span-2">
                  <a
                    href={event.registrationLink || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#FF9900] hover:underline break-all text-sm flex items-center gap-2"
                  >
                    <Link2 size={14} />
                    Open Registration
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Message to CR */}
          {event.messageToCR && (
            <div className="bg-[#1a1a1a] border-2 border-[#2d2d2d] p-4 rounded">
              <h3 className="text-xs font-bold uppercase tracking-widest text-[#888] mb-2">Message to CRs</h3>
              <p className="text-sm text-[#bbb] whitespace-pre-wrap">{event.messageToCR}</p>
            </div>
          )}

          {/* Metadata */}
          <div className="bg-[#1a1a1a] border-2 border-[#2d2d2d] p-4 rounded">
            <div className="grid grid-cols-2 gap-4 text-xs font-mono text-[#888]">
              <div>
                <p className="font-bold mb-1">Created</p>
                <p>{event.createdByName}</p>
                <p>{new Date(event.createdAt).toLocaleString()}</p>
              </div>
              <div>
                <p className="font-bold mb-1">Last Updated</p>
                <p>{event.updatedByName}</p>
                <p>{new Date(event.updatedAt).toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
