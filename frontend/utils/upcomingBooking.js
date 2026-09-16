// Dizajn 31: the day and time lines of a "Sledećih 7 dana" row (357:537),
// read in Belgrade time so the server render and the browser agree.

const TIME_ZONE = 'Europe/Belgrade'
const DAY_MS = 86_400_000

// A NIGHT/DAY/MONTH booking starts and ends on whole days (T82 in
// rezervacije/[id].vue), so its row names the last day instead of hours.
const DATE_ONLY_UNITS = ['NIGHT', 'DAY', 'MONTH', 'YEAR']

const WEEKDAY_INDEX = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }

const formatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

function getParts(value) {
  return Object.fromEntries(formatter.formatToParts(new Date(value)).map((part) => [part.type, part.value]))
}

// "Sub 12.09.", with the weekday from the locale's Monday-first list
// (listing.calendarWeekdays).
export function formatUpcomingDay(value, weekdays) {
  const parts = getParts(value)
  return `${weekdays[WEEKDAY_INDEX[parts.weekday]]} ${parts.day}.${parts.month}.`
}

// "16:00 - 18:00", or null for a booking by whole days or one that runs a day
// or longer, which shows its end day instead.
export function formatUpcomingTimes(booking) {
  const start = new Date(booking.startsAt)
  const end = new Date(booking.endsAt)
  if (DATE_ONLY_UNITS.includes(booking.priceUnit) || end - start >= DAY_MS) return null
  const from = getParts(start)
  const to = getParts(end)
  return `${from.hour}:${from.minute} - ${to.hour}:${to.minute}`
}
