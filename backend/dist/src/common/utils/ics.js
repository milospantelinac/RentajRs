"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseIcs = parseIcs;
exports.buildIcsCalendar = buildIcsCalendar;
function parseIcs(icsText) {
    const events = [];
    const lines = unfoldLines(icsText);
    let current = null;
    for (const line of lines) {
        if (line.startsWith('BEGIN:VEVENT')) {
            current = {};
        }
        else if (line.startsWith('END:VEVENT')) {
            if (current?.uid && current.startsAt && current.endsAt) {
                events.push(current);
            }
            current = null;
        }
        else if (current) {
            if (line.startsWith('UID')) {
                current.uid = line.split(':').slice(1).join(':').trim();
            }
            else if (line.startsWith('DTSTART')) {
                current.startsAt = parseIcsDate(line);
            }
            else if (line.startsWith('DTEND')) {
                current.endsAt = parseIcsDate(line);
            }
        }
    }
    return events;
}
function unfoldLines(icsText) {
    const raw = icsText.split(/\r\n|\n|\r/);
    const unfolded = [];
    for (const line of raw) {
        if ((line.startsWith(' ') || line.startsWith('\t')) && unfolded.length) {
            unfolded[unfolded.length - 1] += line.slice(1);
        }
        else {
            unfolded.push(line);
        }
    }
    return unfolded;
}
function parseIcsDate(line) {
    const value = line.split(':').slice(1).join(':').trim();
    const isAllDay = line.includes('VALUE=DATE') && !line.includes('VALUE=DATE-TIME');
    if (isAllDay) {
        const y = value.slice(0, 4);
        const m = value.slice(4, 6);
        const d = value.slice(6, 8);
        return new Date(`${y}-${m}-${d}T00:00:00Z`);
    }
    const y = value.slice(0, 4);
    const mo = value.slice(4, 6);
    const d = value.slice(6, 8);
    const h = value.slice(9, 11) || '00';
    const mi = value.slice(11, 13) || '00';
    const s = value.slice(13, 15) || '00';
    return new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}Z`);
}
function buildIcsCalendar(events) {
    const toIcsDate = (d) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Rentaj//Rentaj Calendar//SR'];
    for (const event of events) {
        lines.push('BEGIN:VEVENT', `UID:${event.uid}`, `DTSTAMP:${toIcsDate(new Date())}`, `DTSTART:${toIcsDate(event.startsAt)}`, `DTEND:${toIcsDate(event.endsAt)}`, `SUMMARY:${event.summary.replace(/[\n,;]/g, ' ')}`, 'END:VEVENT');
    }
    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
}
//# sourceMappingURL=ics.js.map