'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ExternalLink, Eye, X } from 'lucide-react';
import type { Event, EventStatus, EventMode, EventDuration } from '@/types';
import { extractGoogleDriveFileId, getGoogleDrivePreviewUrl, convertGoogleDriveUrlToPreview } from '@/lib/utils';

const EVENT_TYPES = ['WORKSHOP', 'HACKATHON', 'SEMINAR', 'SOCIAL', 'CONFERENCE', 'TALK', 'OTHER'];
const EVENT_MODES: EventMode[] = ['IN_PERSON', 'ONLINE', 'HYBRID'];

interface EventFormProps {
  initialEvent?: Event;
}

interface FormData {
  name: string;
  description: string;
  duration: EventDuration;
  date: string;
  endDate: string;
  startTime: string;
  endTime: string;
  venue: string;
  banner: string;
  meetupLink: string;
  messageToCR: string;
  eventType: string;
  customEventType: string;
  eventMode: EventMode | '';
  registrationRequired: boolean;
  registrationLink: string;
  registrationDeadline: string;
  participantCapacity: string;
  meetingLink: string;
  status: EventStatus;
}

export default function EventForm({ initialEvent }: EventFormProps) {
  const router = useRouter();
  const isEditMode = !!initialEvent;

  // Memoize duration determination
  const initialDuration = useMemo<EventDuration>(() => {
    if (!initialEvent) return 'SINGLE_DAY';
    return initialEvent.endDate && initialEvent.endDate !== initialEvent.date ? 'MULTI_DAY' : 'SINGLE_DAY';
  }, [initialEvent]);

  const [formData, setFormData] = useState<FormData>({
    name: initialEvent?.name || '',
    description: initialEvent?.description || '',
    duration: initialDuration,
    date: initialEvent?.date || '',
    endDate: initialEvent?.endDate || '',
    startTime: initialEvent?.startTime || '',
    endTime: initialEvent?.endTime || '',
    venue: initialEvent?.venue || '',
    banner: initialEvent?.banner || initialEvent?.bannerImageUrl || '',
    meetupLink: initialEvent?.meetupLink || '',
    messageToCR: initialEvent?.messageToCR || '',
    eventType: initialEvent?.eventType || '',
    customEventType: initialEvent?.customEventType || '',
    eventMode: initialEvent?.eventMode || '',
    registrationRequired: initialEvent?.registrationRequired || false,
    registrationLink: initialEvent?.registrationLink || '',
    registrationDeadline: initialEvent?.registrationDeadline || '',
    participantCapacity: initialEvent?.participantCapacity ? String(initialEvent.participantCapacity) : '',
    meetingLink: initialEvent?.meetingLink || '',
    status: initialEvent?.status || 'DRAFT',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bannerPreviewError, setBannerPreviewError] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  // Compute initial state once with useMemo
  const initialState = useMemo<FormData>(() => ({
    name: initialEvent?.name || '',
    description: initialEvent?.description || '',
    duration: initialDuration,
    date: initialEvent?.date || '',
    endDate: initialEvent?.endDate || '',
    startTime: initialEvent?.startTime || '',
    endTime: initialEvent?.endTime || '',
    venue: initialEvent?.venue || '',
    banner: initialEvent?.banner || initialEvent?.bannerImageUrl || '',
    meetupLink: initialEvent?.meetupLink || '',
    messageToCR: initialEvent?.messageToCR || '',
    eventType: initialEvent?.eventType || '',
    customEventType: initialEvent?.customEventType || '',
    eventMode: initialEvent?.eventMode || '',
    registrationRequired: initialEvent?.registrationRequired || false,
    registrationLink: initialEvent?.registrationLink || '',
    registrationDeadline: initialEvent?.registrationDeadline || '',
    participantCapacity: initialEvent?.participantCapacity ? String(initialEvent.participantCapacity) : '',
    meetingLink: initialEvent?.meetingLink || '',
    status: initialEvent?.status || 'DRAFT',
  }), [initialEvent, initialDuration]);

  // Detect unsaved changes with useMemo
  const hasUnsavedChanges = useMemo(() => {
    if (!isEditMode) return false;
    return JSON.stringify(formData) !== JSON.stringify(initialState);
  }, [formData, isEditMode, initialState]);

  // Auto-save draft on component unmount or navigation
  const saveDraft = useCallback(async (currentFormData: FormData) => {
    if (!currentFormData.name.trim()) return; // Don't save empty drafts
    
    try {
      const payload = {
        name: currentFormData.name,
        description: currentFormData.description,
        date: currentFormData.date,
        endDate: currentFormData.duration === 'MULTI_DAY' ? currentFormData.endDate : null,
        startTime: currentFormData.startTime,
        endTime: currentFormData.endTime,
        venue: currentFormData.venue,
        banner: currentFormData.banner || null,
        meetupLink: currentFormData.meetupLink || null,
        messageToCR: currentFormData.messageToCR || null,
        eventType: currentFormData.eventType || null,
        customEventType: currentFormData.eventType === 'OTHER' ? currentFormData.customEventType : null,
        eventMode: currentFormData.eventMode || null,
        registrationRequired: currentFormData.registrationRequired,
        registrationLink: currentFormData.registrationRequired ? currentFormData.registrationLink : null,
        registrationDeadline: currentFormData.registrationRequired ? currentFormData.registrationDeadline : null,
        participantCapacity: currentFormData.participantCapacity ? parseInt(currentFormData.participantCapacity, 10) : null,
        meetingLink: currentFormData.meetingLink || null,
        status: currentFormData.status,
      };

      const method = isEditMode ? 'PATCH' : 'POST';
      const url = isEditMode ? `/api/events/${initialEvent.eventId}` : '/api/events';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.error('Draft save failed silently');
      }
    } catch (err) {
      console.error('Draft auto-save error:', err);
    }
  }, [isEditMode, initialEvent]);

  // Warn on page unload if unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges && !isSubmitting) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges, isSubmitting]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: checked }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // URL validation
  const isValidUrl = (url: string): boolean => {
    if (!url) return true;
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  // Validate form for publish (strict validation)
  const validateForPublish = (): string | null => {
    if (!formData.name.trim()) return 'Event name is required';
    if (!formData.description.trim()) return 'Event description is required';
    if (!formData.date) return 'Event date is required';
    if (!formData.startTime) return 'Start time is required';
    if (!formData.endTime) return 'End time is required';
    if (!formData.venue.trim()) return 'Venue is required';

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(formData.date)) return 'Date must be in YYYY-MM-DD format';

    // Validate end date if multi-day
    if (formData.duration === 'MULTI_DAY') {
      if (!formData.endDate) return 'End date is required for multi-day events';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(formData.endDate)) return 'End date must be in YYYY-MM-DD format';
      if (formData.endDate < formData.date) return 'End date cannot be earlier than start date';
    }

    // Validate time format
    if (!/^\d{2}:\d{2}$/.test(formData.startTime)) return 'Start time must be in HH:mm format';
    if (!/^\d{2}:\d{2}$/.test(formData.endTime)) return 'End time must be in HH:mm format';

    // Validate time range
    if (formData.startTime >= formData.endTime) return 'Start time must be before end time';

    // Validate event type
    if (formData.eventType === 'OTHER' && !formData.customEventType.trim()) {
      return 'Please specify the custom event type';
    }

    // Validate event mode
    if (formData.eventMode === 'ONLINE' || formData.eventMode === 'HYBRID') {
      if (!formData.meetingLink.trim()) return 'Meeting link is required for ONLINE/HYBRID events';
      if (!isValidUrl(formData.meetingLink)) return 'Meeting link must be a valid URL';
    }

    // Validate venue for IN_PERSON/HYBRID
    if (formData.eventMode === 'IN_PERSON' || formData.eventMode === 'HYBRID') {
      if (!formData.venue.trim()) return 'Venue is required for IN_PERSON/HYBRID events';
    }

    // Validate banner URL if provided
    if (formData.banner && !isValidUrl(formData.banner)) return 'Banner URL must be valid';

    // Validate meetup link if provided
    if (formData.meetupLink && !isValidUrl(formData.meetupLink)) return 'Meetup link must be a valid URL';

    // Validate registration fields
    if (formData.registrationRequired) {
      if (!formData.registrationLink.trim()) return 'Registration link is required';
      if (!isValidUrl(formData.registrationLink)) return 'Registration link must be a valid URL';
      if (!formData.registrationDeadline) return 'Registration deadline is required';
      
      // Validate deadline is before or on event date
      if (formData.registrationDeadline > formData.date) {
        return 'Registration deadline must be on or before the event date';
      }
    }

    // Validate participant capacity if provided
    if (formData.participantCapacity) {
      const capacity = parseInt(formData.participantCapacity, 10);
      if (isNaN(capacity) || capacity <= 0) {
        return 'Participant capacity must be a positive integer';
      }
    }

    return null;
  };

  const handleSaveDraftAndLeave = async () => {
    setIsSavingDraft(true);
    await saveDraft(formData);
    setIsSavingDraft(false);
    router.back();
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();

    const error = validateForPublish();
    if (error) {
      toast.error(error);
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        name: formData.name,
        description: formData.description,
        date: formData.date,
        endDate: formData.duration === 'MULTI_DAY' ? formData.endDate : null,
        startTime: formData.startTime,
        endTime: formData.endTime,
        venue: formData.venue,
        banner: formData.banner || null,
        meetupLink: formData.meetupLink || null,
        messageToCR: formData.messageToCR || null,
        eventType: formData.eventType || null,
        customEventType: formData.eventType === 'OTHER' ? formData.customEventType : null,
        eventMode: formData.eventMode || null,
        registrationRequired: formData.registrationRequired,
        registrationLink: formData.registrationRequired ? formData.registrationLink : null,
        registrationDeadline: formData.registrationRequired ? formData.registrationDeadline : null,
        participantCapacity: formData.participantCapacity ? parseInt(formData.participantCapacity, 10) : null,
        meetingLink: formData.meetingLink || null,
        status: formData.status,
      };

      const method = isEditMode ? 'PATCH' : 'POST';
      const url = isEditMode ? `/api/events/${initialEvent.eventId}` : '/api/events';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || 'Failed to save event');
        return;
      }

      toast.success(isEditMode ? 'Event updated' : 'Event created');
      router.push('/events');
      router.refresh();
    } catch (err) {
      console.error('Form submission error:', err);
      toast.error('An error occurred while saving the event');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handlePublish} className="space-y-6 max-w-3xl">
      {/* Unsaved Changes Notice */}
      {hasUnsavedChanges && isEditMode && (
        <div className="bg-yellow-900/30 border-l-4 border-yellow-600 p-3 text-sm text-yellow-300">
          You have unsaved changes
        </div>
      )}

      {/* Event Details */}
      <div className="border-b-2 border-[#2d2d2d] pb-6">
        <h2 className="text-lg font-bold uppercase tracking-widest text-[#f0f0f0] mb-4">Event Details</h2>

        {/* Event Name */}
        <div className="mb-4">
          <label className="block text-sm font-bold uppercase tracking-widest text-[#f0f0f0] mb-2">
            Event Name *
          </label>
          <Input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="e.g., AWS Innovators Summit 2026"
            disabled={isSubmitting}
          />
        </div>

        {/* Description */}
        <div className="mb-4">
          <label className="block text-sm font-bold uppercase tracking-widest text-[#f0f0f0] mb-2">
            Description *
          </label>
          <Textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Detailed event description"
            rows={4}
            disabled={isSubmitting}
          />
        </div>

        {/* Event Type */}
        <div className="mb-4">
          <label className="block text-sm font-bold uppercase tracking-widest text-[#f0f0f0] mb-2">
            Event Type
          </label>
          <Select value={formData.eventType} onValueChange={value => handleSelectChange('eventType', value)} disabled={isSubmitting}>
            <SelectTrigger>
              <SelectValue placeholder="Select event type..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">None</SelectItem>
              {EVENT_TYPES.map(type => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Custom Event Type - Show when OTHER is selected */}
        {formData.eventType === 'OTHER' && (
          <div className="mb-4">
            <label className="block text-sm font-bold uppercase tracking-widest text-[#f0f0f0] mb-2">
              Specify Event Type *
            </label>
            <Input
              type="text"
              name="customEventType"
              value={formData.customEventType}
              onChange={handleChange}
              placeholder="e.g., Networking Session, Panel Discussion"
              disabled={isSubmitting}
            />
          </div>
        )}
      </div>

      {/* Schedule */}
      <div className="border-b-2 border-[#2d2d2d] pb-6">
        <h2 className="text-lg font-bold uppercase tracking-widest text-[#f0f0f0] mb-4">Schedule</h2>

        {/* Duration Selector */}
        <div className="mb-4">
          <label className="block text-sm font-bold uppercase tracking-widest text-[#f0f0f0] mb-2">
            Duration
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="duration"
                value="SINGLE_DAY"
                checked={formData.duration === 'SINGLE_DAY'}
                onChange={() => handleSelectChange('duration', 'SINGLE_DAY')}
                disabled={isSubmitting}
                className="cursor-pointer"
              />
              <span className="text-sm text-[#bbb]">Single Day</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="duration"
                value="MULTI_DAY"
                checked={formData.duration === 'MULTI_DAY'}
                onChange={() => handleSelectChange('duration', 'MULTI_DAY')}
                disabled={isSubmitting}
                className="cursor-pointer"
              />
              <span className="text-sm text-[#bbb]">Multi-Day</span>
            </label>
          </div>
        </div>

        {/* Start Date */}
        <div className="mb-4">
          <label className="block text-sm font-bold uppercase tracking-widest text-[#f0f0f0] mb-2">
            Start Date *
          </label>
          <Input
            type="date"
            name="date"
            value={formData.date}
            onChange={handleChange}
            disabled={isSubmitting}
          />
        </div>

        {/* End Date - Show only for multi-day */}
        {formData.duration === 'MULTI_DAY' && (
          <div className="mb-4">
            <label className="block text-sm font-bold uppercase tracking-widest text-[#f0f0f0] mb-2">
              End Date *
            </label>
            <Input
              type="date"
              name="endDate"
              value={formData.endDate}
              onChange={handleChange}
              disabled={isSubmitting}
            />
          </div>
        )}

        {/* Start & End Time */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold uppercase tracking-widest text-[#f0f0f0] mb-2">
              Start Time *
            </label>
            <Input
              type="time"
              name="startTime"
              value={formData.startTime}
              onChange={handleChange}
              disabled={isSubmitting}
            />
          </div>
          <div>
            <label className="block text-sm font-bold uppercase tracking-widest text-[#f0f0f0] mb-2">
              End Time *
            </label>
            <Input
              type="time"
              name="endTime"
              value={formData.endTime}
              onChange={handleChange}
              disabled={isSubmitting}
            />
          </div>
        </div>
      </div>

      {/* Location */}
      <div className="border-b-2 border-[#2d2d2d] pb-6">
        <h2 className="text-lg font-bold uppercase tracking-widest text-[#f0f0f0] mb-4">Location</h2>

        {/* Event Mode */}
        <div className="mb-4">
          <label className="block text-sm font-bold uppercase tracking-widest text-[#f0f0f0] mb-2">
            Event Mode
          </label>
          <Select value={formData.eventMode} onValueChange={value => handleSelectChange('eventMode', value)} disabled={isSubmitting}>
            <SelectTrigger>
              <SelectValue placeholder="Select event mode..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">None</SelectItem>
              {EVENT_MODES.map(mode => (
                <SelectItem key={mode} value={mode}>
                  {mode}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Venue - Required for IN_PERSON/HYBRID */}
        <div className="mb-4">
          <label className="block text-sm font-bold uppercase tracking-widest text-[#f0f0f0] mb-2">
            Venue {(formData.eventMode === 'IN_PERSON' || formData.eventMode === 'HYBRID') && '*'}
          </label>
          <Input
            type="text"
            name="venue"
            value={formData.venue}
            onChange={handleChange}
            placeholder="e.g., SRM IST Main Auditorium, Chennai"
            disabled={isSubmitting}
          />
        </div>

        {/* Meeting Link - Required for ONLINE/HYBRID */}
        {(formData.eventMode === 'ONLINE' || formData.eventMode === 'HYBRID') && (
          <div>
            <label className="block text-sm font-bold uppercase tracking-widest text-[#f0f0f0] mb-2">
              Meeting Link *
            </label>
            <Input
              type="url"
              name="meetingLink"
              value={formData.meetingLink}
              onChange={handleChange}
              placeholder="https://meet.google.com/... or https://zoom.us/..."
              disabled={isSubmitting}
            />
          </div>
        )}
      </div>

      {/* Registration */}
      <div className="border-b-2 border-[#2d2d2d] pb-6">
        <h2 className="text-lg font-bold uppercase tracking-widest text-[#f0f0f0] mb-4">Registration</h2>

        <div className="mb-4 flex items-center gap-3">
          <input
            type="checkbox"
            id="registrationRequired"
            name="registrationRequired"
            checked={formData.registrationRequired}
            onChange={handleCheckboxChange}
            disabled={isSubmitting}
            className="w-4 h-4 cursor-pointer"
          />
          <label htmlFor="registrationRequired" className="text-sm font-bold uppercase tracking-widest text-[#f0f0f0] cursor-pointer">
            Registration Required
          </label>
        </div>

        {formData.registrationRequired && (
          <>
            <div className="mb-4">
              <label className="block text-sm font-bold uppercase tracking-widest text-[#f0f0f0] mb-2">
                Registration Link *
              </label>
              <Input
                type="url"
                name="registrationLink"
                value={formData.registrationLink}
                onChange={handleChange}
                placeholder="https://forms.google.com/... or registration URL"
                disabled={isSubmitting}
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-bold uppercase tracking-widest text-[#f0f0f0] mb-2">
                Registration Deadline *
              </label>
              <Input
                type="date"
                name="registrationDeadline"
                value={formData.registrationDeadline}
                onChange={handleChange}
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label className="block text-sm font-bold uppercase tracking-widest text-[#f0f0f0] mb-2">
                Participant Capacity
              </label>
              <Input
                type="number"
                name="participantCapacity"
                value={formData.participantCapacity}
                onChange={handleChange}
                placeholder="Leave blank for unlimited"
                disabled={isSubmitting}
                min="1"
              />
            </div>
          </>
        )}
      </div>

      {/* Media */}
      <div className="border-b-2 border-[#2d2d2d] pb-6">
        <h2 className="text-lg font-bold uppercase tracking-widest text-[#f0f0f0] mb-4">Media</h2>

        {/* Banner */}
        <div className="mb-6">
          <label className="block text-sm font-bold uppercase tracking-widest text-[#f0f0f0] mb-2">
            Banner Image URL (Google Drive)
          </label>
          <div className="space-y-2">
            <Input
              type="text"
              name="banner"
              value={formData.banner}
              onChange={(e) => {
                handleChange(e);
                setBannerPreviewError(false);
              }}
              placeholder="https://drive.google.com/file/d/FILE_ID/view or paste a Google Drive sharing link"
              disabled={isSubmitting}
            />
            {formData.banner && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (formData.banner) window.open(formData.banner, '_blank');
                  }}
                  className="text-xs px-3 py-1 bg-[#1a1a1a] border border-[#2d2d2d] text-[#FF9900] hover:bg-[#2d2d2d] rounded flex items-center gap-2"
                >
                  <ExternalLink size={12} />
                  Open Link
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFormData(prev => ({ ...prev, banner: '' }));
                    setBannerPreviewError(false);
                  }}
                  className="text-xs px-3 py-1 bg-[#1a1a1a] border border-[#2d2d2d] text-[#999] hover:bg-[#2d2d2d] hover:text-[#ccc] rounded flex items-center gap-2"
                >
                  <X size={12} />
                  Clear
                </button>
              </div>
            )}
            {formData.banner && !bannerPreviewError && (
              <div className="w-full h-40 bg-[#1a1a1a] border border-[#2d2d2d] rounded overflow-hidden">
                <img
                  src={convertGoogleDriveUrlToPreview(formData.banner)}
                  alt="Banner preview"
                  className="w-full h-full object-cover"
                  onError={() => setBannerPreviewError(true)}
                />
              </div>
            )}
            {formData.banner && bannerPreviewError && (
              <div className="w-full h-40 bg-[#1a1a1a] border border-[#2d2d2d] rounded flex items-center justify-center">
                <p className="text-xs text-[#888] text-center">Unable to load image preview</p>
              </div>
            )}
          </div>
        </div>

        {/* Meetup Link */}
        <div>
          <label className="block text-sm font-bold uppercase tracking-widest text-[#f0f0f0] mb-2">
            External Event Link (Meetup, etc.)
          </label>
          <Input
            type="url"
            name="meetupLink"
            value={formData.meetupLink}
            onChange={handleChange}
            placeholder="https://www.meetup.com/..."
            disabled={isSubmitting}
          />
        </div>
      </div>

      {/* Internal */}
      <div className="border-b-2 border-[#2d2d2d] pb-6">
        <h2 className="text-lg font-bold uppercase tracking-widest text-[#f0f0f0] mb-4">Internal</h2>

        {/* Status */}
        <div className="mb-6">
          <label className="block text-sm font-bold uppercase tracking-widest text-[#f0f0f0] mb-3">
            Status {isEditMode ? '' : '(default: DRAFT)'}
          </label>
          <div className="space-y-2">
            {['DRAFT', 'PUBLISHED', 'LIVE', 'COMPLETED', 'CANCELLED', 'ARCHIVED'].map((s) => (
              <label key={s} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  value={s}
                  checked={formData.status === s}
                  onChange={() => handleSelectChange('status', s)}
                  disabled={isSubmitting}
                  className="cursor-pointer"
                />
                <span className="text-sm text-[#bbb]">
                  {s}
                  {!isEditMode && s === 'DRAFT' && <span className="text-[#888] ml-2">(default)</span>}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Message to CR */}
        <div>
          <label className="block text-sm font-bold uppercase tracking-widest text-[#f0f0f0] mb-2">
            Message to College Representatives
          </label>
          <Textarea
            name="messageToCR"
            value={formData.messageToCR}
            onChange={handleChange}
            placeholder="Internal note for CRs (optional)"
            rows={3}
            disabled={isSubmitting}
          />
        </div>
      </div>
      <div className="flex gap-3 pt-4">
        <Button
          type="submit"
          disabled={isSubmitting}
          className="flex-1"
        >
          {isSubmitting ? 'Publishing...' : isEditMode ? 'Publish Changes' : 'Publish Event'}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={isSubmitting || isSavingDraft}
          onClick={handleSaveDraftAndLeave}
        >
          {isSavingDraft ? 'Saving Draft...' : 'Save as Draft & Leave'}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={isSubmitting}
          onClick={() => {
            if (hasUnsavedChanges && !confirm('You have unsaved changes. Are you sure you want to discard them?')) {
              return;
            }
            router.back();
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
