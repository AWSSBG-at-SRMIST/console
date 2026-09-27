import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db, TABLE, GetCommand, UpdateCommand, DeleteCommand } from '@/lib/dynamodb';
import { logAction } from '@/lib/audit';
import { canManageEvents } from '@/lib/permissions';
import { eventDateForStorage, isEventDateSet } from '@/lib/events';
import type { Event, EventStatus } from '@/types';

const VALID_STATUSES: EventStatus[] = ['DRAFT', 'PUBLISHED', 'LIVE', 'COMPLETED', 'CANCELLED', 'ARCHIVED'];

// Get a single event by ID
export async function GET(req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canManageEvents(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { eventId } = await params;
    const result = await db.send(new GetCommand({
      TableName: TABLE.EVENTS,
      Key: { eventId },
    }));

    if (!result.Item) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: result.Item as Event });
  } catch (error) {
    console.error('Get event error:', error);
    return NextResponse.json({ error: 'Failed to fetch event' }, { status: 500 });
  }
}

// Update an event (Presidium and Directors)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const user = await getCurrentUser();
  if (!user || !canManageEvents(user)) {
    return NextResponse.json({ error: 'Unauthorized: only Presidium and Directors can update events' }, { status: 403 });
  }

  try {
    const { eventId } = await params;
    const body = await req.json();

    // Get existing event
    const getResult = await db.send(new GetCommand({
      TableName: TABLE.EVENTS,
      Key: { eventId },
    }));

    if (!getResult.Item) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const existing = getResult.Item as Event;

    // Build update expression
    const values: Record<string, unknown> = {};
    let updateExpression = 'SET';
    const expressionAttributeNames: Record<string, string> = {};

    // Allowed fields to update
    const allowedFields = [
      'name', 'description', 'date', 'endDate', 'startTime', 'endTime', 'venue', 'banner', 'meetupLink', 'messageToCR',
      'eventType', 'customEventType', 'eventMode', 'registrationRequired', 'registrationLink', 'registrationDeadline',
      'participantCapacity', 'meetingLink', 'status'
    ];

    for (const field of allowedFields) {
      if (field in body) {
        const value = body[field];

        let storedValue = value;

        if (field === 'date') {
          storedValue = eventDateForStorage(value);
          if (isEventDateSet(storedValue) && !/^\d{4}-\d{2}-\d{2}$/.test(storedValue)) {
            return NextResponse.json({ error: 'date must be in ISO format (YYYY-MM-DD)' }, { status: 400 });
          }
        }
        if (field === 'endDate' && value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
          return NextResponse.json({ error: 'endDate must be in ISO format (YYYY-MM-DD)' }, { status: 400 });
        }
        if ((field === 'startTime' || field === 'endTime') && value && !/^\d{2}:\d{2}$/.test(value)) {
          return NextResponse.json({ error: 'startTime and endTime must be in HH:mm format' }, { status: 400 });
        }
        if (field === 'status' && value && !VALID_STATUSES.includes(value)) {
          return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
        }

        const newStartTime = body.startTime ?? existing.startTime;
        const newEndTime = body.endTime ?? existing.endTime;
        if (newStartTime && newEndTime && newStartTime >= newEndTime) {
          return NextResponse.json({ error: 'startTime must be before endTime' }, { status: 400 });
        }

        if (field === 'endDate' && value) {
          const newDate = eventDateForStorage(body.date ?? existing.date);
          if (isEventDateSet(newDate) && value < newDate) {
            return NextResponse.json({ error: 'endDate cannot be earlier than date' }, { status: 400 });
          }
        }
        if (field === 'date' && isEventDateSet(storedValue)) {
          const newEndDate = body.endDate || existing.endDate;
          if (newEndDate && storedValue > newEndDate) {
            return NextResponse.json({ error: 'date cannot be later than endDate' }, { status: 400 });
          }
        }

        // Validate event mode
        if (field === 'eventMode' && value && !['IN_PERSON', 'ONLINE', 'HYBRID'].includes(value)) {
          return NextResponse.json({ error: 'Invalid event mode' }, { status: 400 });
        }

        // Validate registration fields
        if (field === 'registrationRequired' && value === true) {
          const nextStatus = body.status || existing.status;
          if (nextStatus !== 'DRAFT') {
            if (!body.registrationLink && !existing.registrationLink) {
              return NextResponse.json({ error: 'Registration link is required when registration is required' }, { status: 400 });
            }
            if (!body.registrationDeadline && !existing.registrationDeadline) {
              return NextResponse.json({ error: 'Registration deadline is required when registration is required' }, { status: 400 });
            }
          }
        }

        // Validate participant capacity
        if (field === 'participantCapacity' && value && (value <= 0 || !Number.isInteger(value))) {
          return NextResponse.json({ error: 'Participant capacity must be a positive integer' }, { status: 400 });
        }

        expressionAttributeNames[`#${field}`] = field;
        values[`:${field}`] = storedValue !== undefined ? storedValue : null;
        updateExpression += ` #${field} = :${field},`;
      }
    }

    // Always update metadata
    expressionAttributeNames['#updatedBy'] = 'updatedBy';
    expressionAttributeNames['#updatedByName'] = 'updatedByName';
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    values[':updatedBy'] = user.memberId;
    values[':updatedByName'] = user.name;
    values[':updatedAt'] = new Date().toISOString();
    updateExpression += ' #updatedBy = :updatedBy, #updatedByName = :updatedByName, #updatedAt = :updatedAt';

    // Execute update
    const updateResult = await db.send(new UpdateCommand({
      TableName: TABLE.EVENTS,
      Key: { eventId },
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: values,
      ReturnValues: 'ALL_NEW',
    }));

    // Log audit
    const changedFields = Object.keys(body).filter(k => allowedFields.includes(k));
    await logAction(user, 'UPDATE_EVENT', 'Event', eventId, `Updated fields: ${changedFields.join(', ')}`);

    return NextResponse.json({ success: true, data: updateResult.Attributes as Event });
  } catch (error) {
    console.error('Update event error:', error);
    return NextResponse.json({ error: 'Failed to update event' }, { status: 500 });
  }
}

// Delete an event (Presidium and Directors)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const user = await getCurrentUser();
  if (!user || !canManageEvents(user)) {
    return NextResponse.json({ error: 'Unauthorized: only Presidium and Directors can delete events' }, { status: 403 });
  }

  try {
    const { eventId } = await params;

    // Verify event exists before deleting
    const getResult = await db.send(new GetCommand({
      TableName: TABLE.EVENTS,
      Key: { eventId },
    }));

    if (!getResult.Item) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const event = getResult.Item as Event;

    // Delete the event
    await db.send(new DeleteCommand({
      TableName: TABLE.EVENTS,
      Key: { eventId },
    }));

    // Log audit
    await logAction(user, 'DELETE_EVENT', 'Event', eventId, `Event deleted: ${event.name}`);

    return NextResponse.json({ success: true, message: 'Event deleted successfully' });
  } catch (error) {
    console.error('Delete event error:', error);
    return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 });
  }
}
