// Dizajn 33: what a listing's iCal page (frame 572:641) says about it and
// about each calendar connected to it.
import { srPluralCategory } from './pluralize'

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

// The feed an owner pastes elsewhere lives on the site's own address
// (server/routes/ical/[file].ts passes it on to the API).
export function getIcalExportUrl(siteUrl, token) {
  return `${String(siteUrl).replace(/\/+$/, '')}/ical/${token}.ics`
}

// "Moji oglasi · Igraonica Balončići - Vračar"
export function formatIcalBreadcrumb(t, listing) {
  const place = listing.cityAreaName || listing.cityName
  const title = listing.title || t('myListings.untitled')
  return `${t('listing.myListings')} · ${place ? `${title} - ${place}` : title}`
}

// "upravo sada", "pre 12 minuta", "pre 1 sat", "pre 3 dana"
export function formatSyncAge(t, value, now = Date.now()) {
  const age = Math.max(0, now - new Date(value).getTime())
  if (age < MINUTE_MS) return t('ical.agoJustNow')
  const [unit, size] = age < HOUR_MS ? ['Minutes', MINUTE_MS] : age < DAY_MS ? ['Hours', HOUR_MS] : ['Days', DAY_MS]
  const count = Math.floor(age / size)
  return t(`ical.ago${unit}${srPluralCategory(count)}`, { count })
}

// 572:942 and 572:956: the name, when it last synced or what went wrong, and a pill.
export function buildIcalSourceRow(t, source, now = Date.now()) {
  const failed = source.status === 'ERROR'
  let detail
  if (failed) detail = t(`ical.errors.${source.error === 'NOT_CALENDAR' ? 'NOT_CALENDAR' : 'UNREACHABLE'}`)
  else if (source.lastSyncedAt) detail = t('ical.lastSynced', { ago: formatSyncAge(t, source.lastSyncedAt, now) })
  else detail = t('ical.notSyncedYet')
  return {
    id: source.id,
    name: source.name,
    url: source.url,
    failed,
    detail,
    statusText: t(failed ? 'ical.statusError' : 'ical.statusActive'),
  }
}

// Dizajn 44: why the page has nothing to connect yet, and the one way on.
export function getIcalLockedState(t, overview) {
  const { availability, listing } = overview
  if (availability === 'NO_ICAL_PACKAGE') {
    return { key: availability, action: { label: t('dashboard.subscriptions'), to: '/kontrolna-tabla/pretplate' } }
  }
  if (availability === 'NOT_PUBLISHED' && listing.status === 'DRAFT') {
    return { key: 'DRAFT', action: { label: t('ical.locked.continueListing'), to: `/oglasi/${listing.id}/uredi` } }
  }
  return { key: availability, action: { label: t('listing.myListings'), to: '/kontrolna-tabla/oglasi' } }
}
