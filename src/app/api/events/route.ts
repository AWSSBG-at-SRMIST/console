import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db, TABLE, ScanCommand, QueryCommand, PutCommand } from '@/lib/dynamodb';
import { logAction } from '@/lib/audit';
import { canManageEvents } from '@/lib/permissions';
import { eventDateForStorage } from '@/lib/events';
import { randomUUID } from 'crypto';
import type { Event, EventStatus } from '@/types';

const VALID_STATUSES: EventStatus[] = ['DRAFT', 'PUBLISHED', 'LIVE', 'COMPLETED', 'CANCELLED', 'ARCHIVED'];

// Get all events or query by status
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canManageEvents(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    if (status && !VALID_STATUSES.includes(status as EventStatus)) {
      return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
    }

    let result;
    if (status) {
      // Query via StatusDateIndex GSI
      result = await db.send(new QueryCommand({
        TableName: TABLE.EVENTS,
        IndexName: 'StatusDateIndex',
        KeyConditionExpression: '#s = :status',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: { ':status': status },
        ScanIndexForward: false, // DESC by date
      }));
    } else {
      // Scan all events
      result = await db.send(new ScanCommand({ TableName: TABLE.EVENTS }));
    }

    const events = ((result.Items || []) as Event[])
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json({ success: true, data: events });
  } catch (error) {
    console.error('Get events error:', error);
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
  }
}

// Create a new event (Presidium and Directors)
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !canManageEvents(user)) {
    return NextResponse.json({ error: 'Unauthorized: only Presidium and Directors can create events' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const {
      name,
      description,
      date,
      endDate,
      startTime,
      endTime,
      venue,
      banner,
      meetupLink,
      messageToCR,
      eventType,
      customEventType,
      eventMode,
      registrationRequired,
      registrationLink,
      registrationDeadline,
      participantCapacity,
      meetingLink,
      status = 'DRAFT',
    } = body;

    const isDraft = status === 'DRAFT';

    if (!name || !String(name).trim()) {
      return NextResponse.json({ error: 'Event name is required' }, { status: 400 });
    }

    // Incomplete drafts are allowed so leaving the create form can persist work.
    // Publish/non-draft still requires the full event.
    if (!isDraft) {
      if (!description || !date || !startTime || !endTime || !venue) {
        return NextResponse.json(
          { error: 'Missing required fields: name, description, date, startTime, endTime, venue' },
          { status: 400 }
        );
      }
    }

    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'date must be in ISO format (YYYY-MM-DD)' }, { status: 400 });
    }

    if (endDate) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
        return NextResponse.json({ error: 'endDate must be in ISO format (YYYY-MM-DD)' }, { status: 400 });
      }
      if (date && endDate < date) {
        return NextResponse.json({ error: 'endDate cannot be earlier than date' }, { status: 400 });
      }
    }

    if (startTime && !/^\d{2}:\d{2}$/.test(startTime)) {
      return NextResponse.json({ error: 'startTime must be in HH:mm format' }, { status: 400 });
    }
    if (endTime && !/^\d{2}:\d{2}$/.test(endTime)) {
      return NextResponse.json({ error: 'endTime must be in HH:mm format' }, { status: 400 });
    }

    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
    }

    if (startTime && endTime && startTime >= endTime) {
      return NextResponse.json({ error: 'startTime must be before endTime' }, { status: 400 });
    }

    if (eventMode && !['IN_PERSON', 'ONLINE', 'HYBRID'].includes(eventMode)) {
      return NextResponse.json({ error: 'Invalid event mode' }, { status: 400 });
    }

    if (!isDraft && registrationRequired) {
      if (!registrationLink) {
        return NextResponse.json({ error: 'Registration link is required when registration is required' }, { status: 400 });
      }
      if (!registrationDeadline) {
        return NextResponse.json({ error: 'Registration deadline is required when registration is required' }, { status: 400 });
      }
      if (date && registrationDeadline > date) {
        return NextResponse.json({ error: 'Registration deadline must be on or before the event date' }, { status: 400 });
      }
    }

    // Validate participant capacity
    if (participantCapacity && (participantCapacity <= 0 || !Number.isInteger(participantCapacity))) {
      return NextResponse.json({ error: 'Participant capacity must be a positive integer' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const eventId = randomUUID();

    const event: Event = {
      eventId,
      name: String(name).trim(),
      description: description || '',
      date: eventDateForStorage(date),
      endDate: endDate || null,
      startTime: startTime || '',
      endTime: endTime || '',
      venue: venue || '',
      banner: banner || null,
      meetupLink: meetupLink || null,
      messageToCR: messageToCR || null,
      eventType: eventType || null,
      customEventType: eventType === 'OTHER' ? customEventType : null,
      eventMode: eventMode || null,
      registrationRequired: registrationRequired || false,
      registrationLink: registrationRequired ? registrationLink : null,
      registrationDeadline: registrationRequired ? registrationDeadline : null,
      participantCapacity: participantCapacity || null,
      meetingLink: meetingLink || null,
      status,
      createdBy: user.memberId,
      createdByName: user.name,
      createdAt: now,
      updatedBy: user.memberId,
      updatedByName: user.name,
      updatedAt: now,
    };

    // Write to DynamoDB
    await db.send(new PutCommand({
      TableName: TABLE.EVENTS,
      Item: event,
    }));

    // Log audit
    await logAction(user, 'CREATE_EVENT', 'Event', eventId, `Event created: ${name}`);

    return NextResponse.json({ success: true, data: event }, { status: 201 });
  } catch (error) {
    console.error('Create event error:', error);
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
  }
}
