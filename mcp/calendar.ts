import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { getMockCalendar, addMockCalendarEvent } from "../lib/db";

export interface CalendarEvent {
  id: string;
  title: string;
  owner_resolved: string;
  start_date: string;
  end_date: string;
}

export async function checkCalendarConflicts(
  client: Client | null,
  ownerEmail: string,
  dateStr: string
): Promise<{ conflict: boolean; details: string | null }> {
  if (!ownerEmail) {
    return { conflict: false, details: null };
  }

  // Parse check date range: dateStr +/- 1 day
  const checkDate = new Date(dateStr);
  if (isNaN(checkDate.getTime())) {
    return { conflict: false, details: null };
  }

  const checkTime = checkDate.getTime();
  const oneDayMs = 24 * 60 * 60 * 1000;

  if (!client) {
    const events = await getMockCalendar() as any[];
    
    // Find any event matching ownerEmail that overlaps checkDate +/- 1 day
    const conflictEvent = events.find(event => {
      if (event.owner_resolved?.toLowerCase() !== ownerEmail.toLowerCase()) {
        return false;
      }
      
      const start = new Date(event.start_date).getTime();
      const end = new Date(event.end_date).getTime();

      // Check overlap: checkDate falls within start-1day to end+1day
      return (
        checkTime >= (start - oneDayMs) && 
        checkTime <= (end + oneDayMs)
      );
    });

    if (conflictEvent) {
      return {
        conflict: true,
        details: `${ownerEmail} has a conflict: "${conflictEvent.title}" on ${conflictEvent.start_date}`,
      };
    }

    return { conflict: false, details: null };
  }

  try {
    // Format date bounds for standard Google Calendar API list
    const timeMin = new Date(checkTime - oneDayMs).toISOString();
    const timeMax = new Date(checkTime + oneDayMs).toISOString();

    const result = await client.callTool({
      name: "google_calendar_list_events",
      arguments: {
        calendarId: ownerEmail,
        timeMin,
        timeMax,
        singleEvents: true,
      }
    });

    const content = (result.content as any)?.[0];
    const events = (typeof content === "string" ? JSON.parse(content) : content?.text ? JSON.parse(content.text) : []) as any[];

    if (events && events.length > 0) {
      // Return first event title as conflict details
      const firstEvent = events[0];
      const summary = firstEvent.summary || firstEvent.title || "Busy";
      const start = firstEvent.start?.date || firstEvent.start?.dateTime || "";
      return {
        conflict: true,
        details: `${ownerEmail} has a conflict: "${summary}" on ${start.slice(0, 10)}`,
      };
    }

    return { conflict: false, details: null };
  } catch (error) {
    console.warn("MCP google_calendar_list_events failed. Falling back to local calendar query.", error);
    // Local fallback
    const events = await getMockCalendar() as any[];
    const conflictEvent = events.find(event => {
      if (event.owner_resolved?.toLowerCase() !== ownerEmail.toLowerCase()) return false;
      const start = new Date(event.start_date).getTime();
      const end = new Date(event.end_date).getTime();
      return (checkTime >= (start - oneDayMs) && checkTime <= (end + oneDayMs));
    });

    if (conflictEvent) {
      return {
        conflict: true,
        details: `${ownerEmail} has a conflict: "${conflictEvent.title}" on ${conflictEvent.start_date} (Local Fallback Check)`,
      };
    }
    return { conflict: false, details: null };
  }
}

export async function createCalendarEvent(
  client: Client | null,
  event: { title: string; owner_resolved: string; date: string }
): Promise<string> {
  const eventId = `cal-event-${Date.now()}`;
  
  if (!client) {
    await addMockCalendarEvent({
      id: eventId,
      title: event.title,
      owner_resolved: event.owner_resolved,
      start_date: event.date,
      end_date: event.date,
    });
    return eventId;
  }

  try {
    await client.callTool({
      name: "google_calendar_create_event",
      arguments: {
        calendarId: event.owner_resolved,
        summary: event.title,
        start: { date: event.date },
        end: { date: event.date },
        attendees: [{ email: event.owner_resolved }]
      }
    });
    return eventId;
  } catch (error) {
    console.error("MCP create calendar event failed. Writing to local sqlite instead.", error);
    await addMockCalendarEvent({
      id: eventId,
      title: event.title,
      owner_resolved: event.owner_resolved,
      start_date: event.date,
      end_date: event.date,
    });
    return eventId;
  }
}
