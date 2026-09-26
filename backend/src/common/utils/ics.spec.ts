import { icalSourceName, isIcsCalendar, normalizeIcalUrl, parseIcs } from './ics';
import { getIcalAvailability } from './ical-availability';

describe('isIcsCalendar (Dizajn 33)', () => {
  it('accepts a feed that opens with BEGIN:VCALENDAR, after a BOM or blank lines too', () => {
    expect(isIcsCalendar('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR')).toBe(true);
    expect(isIcsCalendar('﻿\r\n  begin:vcalendar\nEND:VCALENDAR')).toBe(true);
  });

  it('refuses anything else, even a page that mentions a calendar', () => {
    expect(isIcsCalendar('<!doctype html><p>BEGIN:VCALENDAR</p>')).toBe(false);
    expect(isIcsCalendar('')).toBe(false);
    expect(isIcsCalendar('{"error":"not found"}')).toBe(false);
  });
});

describe('normalizeIcalUrl', () => {
  it('turns a webcal link into the https feed it stands for', () => {
    expect(normalizeIcalUrl('  webcal://p01-caldav.icloud.com/published/2/abc ')).toBe('https://p01-caldav.icloud.com/published/2/abc');
    expect(normalizeIcalUrl('https://www.airbnb.com/calendar/ical/1.ics?s=x')).toBe('https://www.airbnb.com/calendar/ical/1.ics?s=x');
  });
});

describe('icalSourceName', () => {
  it.each([
    ['https://www.airbnb.com/calendar/ical/123.ics?s=abc', 'Airbnb'],
    ['https://www.airbnb.rs/calendar/ical/123.ics', 'Airbnb'],
    ['https://www.airbnb.co.uk/calendar/ical/123.ics', 'Airbnb'],
    ['https://admin.booking.com/hotel/hoteladmin/ical.html?t=abc', 'Booking.com'],
    ['https://ical.booking.com/v1/export?t=abc', 'Booking.com'],
    ['https://calendar.google.com/calendar/ical/x%40group.calendar.google.com/private-1/basic.ics', 'Google Calendar'],
    ['http://www.vrbo.com/icalendar/abc.ics', 'Vrbo'],
    ['https://outlook.live.com/owa/calendar/abc/reachcalendar.ics', 'Outlook'],
    ['https://p01-caldav.icloud.com/published/2/abc', 'iCloud'],
    ['https://www.kalendar.primer.rs/feed.ics', 'kalendar.primer.rs'],
    ['http://127.0.0.1:3399/feed.ics', '127.0.0.1'],
  ])('names %s "%s"', (url, name) => {
    expect(icalSourceName(url)).toBe(name);
  });

  it('does not borrow a platform name for a look-alike host', () => {
    expect(icalSourceName('https://airbnb.example.com/feed.ics')).toBe('airbnb.example.com');
    expect(icalSourceName('https://booking.com.example.org/feed.ics')).toBe('booking.com.example.org');
  });
});

describe('parseIcs', () => {
  it('reads timed and all-day events', () => {
    const events = parseIcs(
      [
        'BEGIN:VCALENDAR',
        'BEGIN:VEVENT',
        'UID:a@airbnb',
        'DTSTART;VALUE=DATE:20261003',
        'DTEND;VALUE=DATE:20261006',
        'END:VEVENT',
        'BEGIN:VEVENT',
        'UID:b',
        'DTSTART:20261010T140000Z',
        'DTEND:20261011T100000Z',
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\r\n'),
    );
    expect(events).toEqual([
      { uid: 'a@airbnb', startsAt: new Date('2026-10-03T00:00:00Z'), endsAt: new Date('2026-10-06T00:00:00Z') },
      { uid: 'b', startsAt: new Date('2026-10-10T14:00:00Z'), endsAt: new Date('2026-10-11T10:00:00Z') },
    ]);
  });
});

describe('getIcalAvailability (Dizajn 33)', () => {
  const stay = { status: 'ACTIVE', bookingModel: 'PER_STAY', priceUnit: 'NIGHT' } as const;

  it('opens for a published night or day stay on a package with iCal', () => {
    expect(getIcalAvailability(stay, true)).toBe('AVAILABLE');
    expect(getIcalAvailability({ ...stay, priceUnit: 'DAY' }, true)).toBe('AVAILABLE');
  });

  it('says why it is closed, the listing kind first', () => {
    expect(getIcalAvailability({ ...stay, priceUnit: 'MONTH' }, true)).toBe('NOT_STAY');
    expect(getIcalAvailability({ ...stay, bookingModel: 'PER_SLOT', priceUnit: 'HOUR' }, true)).toBe('NOT_STAY');
    expect(getIcalAvailability({ ...stay, bookingModel: 'NO_BOOKING', status: 'DRAFT' }, false)).toBe('NOT_STAY');
    expect(getIcalAvailability({ ...stay, status: 'PENDING_APPROVAL' }, true)).toBe('NOT_PUBLISHED');
    expect(getIcalAvailability({ ...stay, status: 'EXPIRED' }, false)).toBe('NOT_PUBLISHED');
    expect(getIcalAvailability(stay, false)).toBe('NO_ICAL_PACKAGE');
  });
});
