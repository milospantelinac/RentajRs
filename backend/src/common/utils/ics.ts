/**
 * Minimal iCalendar (RFC 5545) helpers — just enough to interoperate with
 * Airbnb/Booking.com-style export feeds (R64/R65). Deliberately not a full
 * RFC implementation (no RRULE/timezone-database support): those feeds are
 * flat lists of VEVENT blocks with UTC or all-day dates, which covers what
 * every mainstream booking platform actually exports.
 */

export interface ParsedIcsEvent {
  uid: string;
  startsAt: Date;
  endsAt: Date;
}

export function parseIcs(icsText: string): ParsedIcsEvent[] {
  const events: ParsedIcsEvent[] = [];
  const lines = unfoldLines(icsText);

  let current: Partial<ParsedIcsEvent> | null = null;
  for (const line of lines) {
    if (line.startsWith('BEGIN:VEVENT')) {
      current = {};
    } else if (line.startsWith('END:VEVENT')) {
      if (current?.uid && current.startsAt && current.endsAt) {
        events.push(current as ParsedIcsEvent);
      }
      current = null;
    } else if (current) {
      if (line.startsWith('UID')) {
        current.uid = line.split(':').slice(1).join(':').trim();
      } else if (line.startsWith('DTSTART')) {
        current.startsAt = parseIcsDate(line);
      } else if (line.startsWith('DTEND')) {
        current.endsAt = parseIcsDate(line);
      }
    }
  }
  return events;
}

function unfoldLines(icsText: string): string[] {
  // RFC 5545: a line beginning with a space/tab is a continuation of the previous line.
  const raw = icsText.split(/\r\n|\n|\r/);
  const unfolded: string[] = [];
  for (const line of raw) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && unfolded.length) {
      unfolded[unfolded.length - 1] += line.slice(1);
    } else {
      unfolded.push(line);
    }
  }
  return unfolded;
}

function parseIcsDate(line: string): Date {
  const value = line.split(':').slice(1).join(':').trim();
  const isAllDay = line.includes('VALUE=DATE') && !line.includes('VALUE=DATE-TIME');

  if (isAllDay) {
    const y = value.slice(0, 4);
    const m = value.slice(4, 6);
    const d = value.slice(6, 8);
    return new Date(`${y}-${m}-${d}T00:00:00Z`);
  }

  // Basic format: 20260815T140000Z (UTC) or 20260815T140000 (floating/local — treated as UTC, a
  // reasonable approximation since v1 only serves the Serbian market/timezone anyway, R16).
  const y = value.slice(0, 4);
  const mo = value.slice(4, 6);
  const d = value.slice(6, 8);
  const h = value.slice(9, 11) || '00';
  const mi = value.slice(11, 13) || '00';
  const s = value.slice(13, 15) || '00';
  return new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}Z`);
}

export function buildIcsCalendar(
  events: Array<{ uid: string; startsAt: Date; endsAt: Date; summary: string }>,
): string {
  const toIcsDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Rentaj//Rentaj Calendar//SR'];
  for (const event of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${event.uid}`,
      `DTSTAMP:${toIcsDate(new Date())}`,
      `DTSTART:${toIcsDate(event.startsAt)}`,
      `DTEND:${toIcsDate(event.endsAt)}`,
      `SUMMARY:${event.summary.replace(/[\n,;]/g, ' ')}`,
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
