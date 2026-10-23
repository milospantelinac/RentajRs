// T129, Administracija > Istaknuti oglasi: the small readings its panels share.
import { srPluralCategory } from './pluralize'

const TIME_ZONE = 'Europe/Belgrade'
const DAY_MS = 86_400_000

// "23. 10. 2026."
export function formatFeaturedDay(value) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('sr-RS', { timeZone: TIME_ZONE })
}

// "još 12 dana", "ističe danas"
export function featuredDaysLeft(t, until, now = Date.now()) {
  const days = Math.ceil((new Date(until).getTime() - now) / DAY_MS)
  if (days <= 1) return t('admin.featured.endsToday')
  return t(`admin.featured.daysLeft${srPluralCategory(days)}`, { count: days })
}

// The admin pill of each source: a leader's period stands out in green.
const SOURCE_PILLS = {
  LEADER: 'admin-pill-success',
  ADMIN: 'admin-pill-info',
  REQUEST: 'admin-pill-neutral',
  PAID: 'admin-pill-warning',
}

export function featuredSourcePill(source) {
  return SOURCE_PILLS[source] || 'admin-pill-neutral'
}

// YYYY-MM-DD of a moment on this computer's calendar, for <input type="date">.
export function toDateInput(value) {
  const date = new Date(value)
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

// The chosen day at the clock time the period ends now, so "+7 dana" is exactly a week more.
export function dateInputAtTimeOf(dateInput, timeSource) {
  const time = new Date(timeSource)
  const [year, month, day] = dateInput.split('-').map(Number)
  return new Date(year, month - 1, day, time.getHours(), time.getMinutes(), time.getSeconds())
}

export function personLabel(person) {
  if (!person) return '-'
  return [person.name, person.email].filter(Boolean).join(' · ')
}
