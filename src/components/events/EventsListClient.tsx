'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Trash2, Edit2, Search, X, Calendar, Clock, MapPin, Globe, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { MeetupLogo } from '@/components/events/MeetupLogo';
import { EventBannerImage } from '@/components/events/EventBannerImage';
import { isEventDateSet } from '@/lib/events';
import type { Event, EventStatus } from '@/types';

const STATUS_COLORS: Record<EventStatus, { bg: string; badge: string; border: string; tint: string }> = {
  DRAFT: { bg: 'hover:bg-gray-900/30', badge: 'bg-gray-600', border: 'border-gray-700', tint: 'from-gray-900/0 to-gray-900/20' },
  PUBLISHED: { bg: 'hover:bg-blue-900/20', badge: 'bg-blue-600', border: 'border-blue-700', tint: 'from-blue-900/0 to-blue-900/15' },
  LIVE: { bg: 'hover:bg-green-900/20', badge: 'bg-green-600', border: 'border-green-700', tint: 'from-green-900/0 to-green-900/15' },
  COMPLETED: { bg: 'hover:bg-purple-900/20', badge: 'bg-purple-600', border: 'border-purple-700', tint: 'from-purple-900/0 to-purple-900/15' },
  CANCELLED: { bg: 'hover:bg-red-900/20', badge: 'bg-red-600', border: 'border-red-700', tint: 'from-red-900/0 to-red-900/15' },
  ARCHIVED: { bg: 'hover:bg-gray-800/20', badge: 'bg-gray-500', border: 'border-gray-600', tint: 'from-gray-900/0 to-gray-900/10' },
};

interface EventsListClientProps {
  events: Event[];
  canCreate: boolean;
  canManageEvents: boolean;
}

export default function EventsListClient({ events: initialEvents, canCreate, canManageEvents }: EventsListClientProps) {
  const router = useRouter();
  const [events, setEvents] = useState(initialEvents);
  const [statusFilter, setStatusFilter] = useState<EventStatus | ''>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredEvents = events.filter(e => {
    const matchesStatus = !statusFilter || e.status === statusFilter;
    const matchesSearch = !searchTerm || 
      e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.description.toLowerCase().includes(searchTerm.toLowerCase());
    // Users without Event management access should not see DRAFT events
    const isVisible = canManageEvents || e.status !== 'DRAFT';
    return matchesStatus && matchesSearch && isVisible;
  });

  const handleDelete = async (eventId: string, eventName: string) => {
    if (!confirm(`Are you sure you want to delete "${eventName}"?`)) return;

    setDeletingId(eventId);
    try {
      const response = await fetch(`/api/events/${eventId}`, { method: 'DELETE' });
      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || 'Failed to delete event');
        return;
      }

      setEvents(prev => prev.filter(e => e.eventId !== eventId));
      toast.success('Event deleted successfully');
      router.refresh();
    } catch (err) {
      console.error('Delete error:', err);
      toast.error('An error occurred while deleting the event');
    } finally {
      setDeletingId(null);
    }
  };

  // Format date range display
  const formatDateRange = (event: Event): string => {
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

  const getStatusBadgeText = (status: EventStatus): string => {
    return status.charAt(0) + status.slice(1).toLowerCase();
  };

  const handleStatusUpdate = async (eventId: string, status: EventStatus) => {
    try {
      const response = await fetch(`/api/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const result = await response.json();
      if (!response.ok) {
        toast.error(result.error || 'Failed to update status');
        return;
      }
      setEvents(prev => prev.map(e => e.eventId === eventId ? { ...e, status } : e));
      toast.success(`Event status changed to ${getStatusBadgeText(status)}`);
    } catch (err) {
      console.error('Status update error:', err);
      toast.error('An error occurred while updating the status');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-widest text-white mb-1">Events</h1>
          <p className="text-sm text-[#888] font-mono">Manage AWSSBG events and activities</p>
        </div>
        {canCreate && (
          <Button asChild>
            <Link href="/events/new">Create Event</Link>
          </Button>
        )}
      </div>

      {/* Search and Filters */}
      <div className="space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#666] pointer-events-none" size={18} />
          <Input
            type="text"
            placeholder="Search events by name or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-10"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#666] hover:text-[#999]"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-3 flex-wrap">
          <label className="text-sm font-bold uppercase tracking-widest text-[#f0f0f0]">Status:</label>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setStatusFilter('')}
              className={cn(
                'px-3 py-1 rounded text-xs font-bold uppercase tracking-widest transition-all border-2',
                !statusFilter
                  ? 'bg-[#FF9900] border-[#FF9900] text-black'
                  : 'bg-[#1a1a1a] border-[#2d2d2d] text-[#888] hover:border-[#FF9900] hover:text-[#FF9900]'
              )}
            >
              All
            </button>
            {canManageEvents && (
              <button
                onClick={() => setStatusFilter('DRAFT')}
                className={cn(
                  'px-3 py-1 rounded text-xs font-bold uppercase tracking-widest transition-all border-2',
                  statusFilter === 'DRAFT'
                    ? 'bg-gray-600 border-gray-600 text-white'
                    : 'bg-[#1a1a1a] border-[#2d2d2d] text-[#888] hover:border-gray-600 hover:text-gray-400'
                )}
              >
                Draft
              </button>
            )}
            {['PUBLISHED', 'LIVE', 'COMPLETED', 'CANCELLED', 'ARCHIVED'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status as EventStatus)}
                className={cn(
                  'px-3 py-1 rounded text-xs font-bold uppercase tracking-widest transition-all border-2',
                  statusFilter === status
                    ? cn('text-white border-[#FF9900]', STATUS_COLORS[status as EventStatus].badge)
                    : 'bg-[#1a1a1a] border-[#2d2d2d] text-[#888] hover:border-[#FF9900] hover:text-[#FF9900]'
                )}
              >
                {getStatusBadgeText(status as EventStatus)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Events Grid */}
      <div>
        {filteredEvents.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-[#2d2d2d] rounded-lg">
            <p className="text-[#888] text-sm font-mono">
              {events.length === 0 ? 'No events yet' : 'No events match the search or filter'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEvents.map(event => {
              const colors = STATUS_COLORS[event.status];

              return (
                <div
                  key={event.eventId}
                  className={cn(
                    'group relative border-2 border-[#2d2d2d] rounded-lg overflow-hidden transition-all duration-300',
                    'hover:border-[#FF9900] hover:shadow-lg focus-within:border-[#FF9900]',
                    colors.bg
                  )}
                >
                  <Link
                    href={`/events/${event.eventId}`}
                    aria-label={`View ${event.name}`}
                    className="absolute inset-0 z-1"
                  />
                  {event.meetupLink && (
                    <a
                      href={event.meetupLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="View on Meetup"
                      title="View on Meetup"
                      className="absolute top-2 right-2 z-2 flex h-8 w-8 items-center justify-center rounded-full bg-[#ED1C40] text-white shadow-md hover:scale-105 transition-transform"
                    >
                      <MeetupLogo size={16} />
                    </a>
                  )}

                  {/* Banner */}
                  {event.banner || event.bannerImageUrl ? (
                    <div className="relative w-full h-40 bg-[#1a1a1a] overflow-hidden border-b-2 border-[#2d2d2d]">
                      <EventBannerImage
                        url={event.banner || event.bannerImageUrl || ''}
                        alt={event.name}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      {/* Status tint overlay */}
                      <div className={cn('absolute inset-0 bg-gradient-to-b', colors.tint)} />
                    </div>
                  ) : (
                    <div className={cn('relative w-full h-24 bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] border-b-2 border-[#2d2d2d]', colors.tint)} />
                  )}

                  {/* Content */}
                  <div className="p-4 space-y-3">
                    {/* Title & Status */}
                    <div className="space-y-2">
                      <h3 className="text-base font-bold uppercase truncate group-hover:text-[#FF9900] transition-colors">
                        {event.name}
                      </h3>
                      <Badge className={cn('text-white text-xs font-bold uppercase px-2 py-1', colors.badge)}>
                        {getStatusBadgeText(event.status)}
                      </Badge>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-[#888] font-mono line-clamp-2">{event.description}</p>

                    {/* Event Metadata */}
                    <div className="space-y-2 border-t border-[#2d2d2d] pt-3">
                      {/* Date & Time */}
                      <div className="flex items-center gap-2 text-xs text-[#bbb] font-mono">
                        <Calendar size={14} className="text-[#FF9900] flex-shrink-0" />
                        <span>{formatDateRange(event)}</span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-[#bbb] font-mono">
                        <Clock size={14} className="text-[#FF9900] flex-shrink-0" />
                        <span>{event.startTime} – {event.endTime}</span>
                      </div>

                      {/* Venue or Online */}
                      {event.eventMode === 'ONLINE' || event.eventMode === 'HYBRID' ? (
                        <div className="flex items-center gap-2 text-xs text-[#bbb] font-mono">
                          <Globe size={14} className="text-[#FF9900] flex-shrink-0" />
                          <span>{event.eventMode === 'HYBRID' ? 'Hybrid' : 'Online'}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-xs text-[#bbb] font-mono">
                          <MapPin size={14} className="text-[#FF9900] flex-shrink-0" />
                          <span className="truncate">{event.venue}</span>
                        </div>
                      )}

                      {/* Event Type */}
                      {event.eventType && (
                        <div className="flex items-center gap-2 text-xs text-[#bbb] font-mono">
                          <Tag size={14} className="text-[#FF9900] flex-shrink-0" />
                          <span>{event.eventType === 'OTHER' ? event.customEventType : event.eventType}</span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="relative z-2 flex gap-2 pt-2">
                      <Button asChild size="sm" variant="outline" className="flex-1 w-full">
                        <Link href={`/events/${event.eventId}`}>View</Link>
                      </Button>
                      {canCreate && (
                        <>
                          <Button asChild size="sm" variant="outline" className="gap-1">
                            <Link href={`/events/${event.eventId}/edit`} aria-label="Edit event">
                              <Edit2 size={14} />
                            </Link>
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            disabled={deletingId === event.eventId}
                            onClick={() => handleDelete(event.eventId, event.name)}
                            className="gap-1"
                            aria-label="Delete event"
                          >
                            <Trash2 size={14} />
                          </Button>
                        </>
                      )}
                    </div>

                    {/* Metadata */}
                    <div className="text-xs text-[#666] font-mono border-t border-[#2d2d2d] pt-2">
                      <div className="flex items-center justify-between">
                        <p>by {event.createdByName}</p>
                        {canManageEvents && (
                          <div className="relative z-2 group/status">
                            <button
                              type="button"
                              aria-haspopup="menu"
                              aria-label={`Change status, currently ${getStatusBadgeText(event.status)}`}
                              className="text-xs px-2 py-1 bg-[#1a1a1a] border border-[#2d2d2d] text-[#FF9900] hover:bg-[#2d2d2d] rounded transition-colors"
                            >
                              {getStatusBadgeText(event.status)} ▼
                            </button>
                            <div
                              role="menu"
                              aria-label="Event status"
                              className="absolute right-0 bottom-full mb-1 w-32 bg-[#1a1a1a] border-2 border-[#2d2d2d] rounded-lg shadow-lg opacity-0 invisible pointer-events-none group-hover/status:opacity-100 group-hover/status:visible group-hover/status:pointer-events-auto group-focus-within/status:opacity-100 group-focus-within/status:visible group-focus-within/status:pointer-events-auto transition-opacity z-10 before:absolute before:left-0 before:right-0 before:top-full before:h-1 before:content-['']"
                            >
                              {(['DRAFT', 'PUBLISHED', 'LIVE', 'COMPLETED', 'CANCELLED', 'ARCHIVED'] as EventStatus[]).map((s) => (
                                <button
                                  key={s}
                                  type="button"
                                  role="menuitem"
                                  onClick={() => handleStatusUpdate(event.eventId, s)}
                                  className={cn(
                                    'block w-full text-left px-3 py-2 text-xs font-bold uppercase tracking-widest transition-colors',
                                    event.status === s
                                      ? 'bg-[#FF9900] text-black'
                                      : 'text-[#888] hover:bg-[#2d2d2d] hover:text-[#FF9900]'
                                  )}
                                >
                                  {getStatusBadgeText(s)}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Summary */}
      {events.length > 0 && (
        <div className="text-xs text-[#666] font-mono text-center pt-4">
          {filteredEvents.length} of {events.filter(e => canManageEvents || e.status !== 'DRAFT').length} event{filteredEvents.length !== 1 ? 's' : ''}
          {(statusFilter || searchTerm) && ` (${filteredEvents.length} matching current filters)`}
        </div>
      )}
    </div>
  );
}
