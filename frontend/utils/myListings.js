// Dizajn 32: what the "Moji oglasi" table (380:526) says about each listing,
// with dates read in Belgrade time so the server render and the browser agree.
import { srPluralCategory } from './pluralize'
import { getWizardSteps } from './wizardSteps'

const TIME_ZONE = 'Europe/Belgrade'
const DAY_MS = 86_400_000
// The same week the home page's "subscription_expiring" task uses.
const EXPIRING_SOON_MS = 7 * DAY_MS

// The status tabs of 380:501 in the frame's order; ALL is the page without ?status.
export const MY_LISTINGS_TABS = ['ALL', 'ACTIVE', 'PENDING_APPROVAL', 'DRAFT', 'EXPIRED', 'REJECTED']

// 380:497 names the published states first and the drafts last.
const SUMMARY_ORDER = ['ACTIVE', 'EXPIRED', 'PENDING_APPROVAL', 'REJECTED', 'DRAFT']

// A listing that never went live has no package period or bookings (380:634).
const PUBLISHED_STATUSES = ['ACTIVE', 'EXPIRED']

const STATUS_LABELS = {
  DRAFT: 'listing.statusDraft',
  PENDING_APPROVAL: 'listing.statusPendingApproval',
  REJECTED: 'listing.statusRejected',
  ACTIVE: 'listing.statusActive',
  EXPIRED: 'listing.statusExpired',
}

const dayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' })

function belgradeDayNumber(value) {
  const [year, month, day] = dayFormatter.format(new Date(value)).split('-').map(Number)
  return Date.UTC(year, month - 1, day) / DAY_MS
}

// "1. 10. 2026."
export function formatListingDate(value) {
  return new Date(value).toLocaleDateString('sr-RS', { timeZone: TIME_ZONE })
}

export function getMyListingsTab(status) {
  return MY_LISTINGS_TABS.includes(status) ? status : 'ALL'
}

export function filterMyListings(listings, tab) {
  return tab === 'ALL' ? listings : listings.filter((listing) => listing.status === tab)
}

export function countMyListings(listings, tab) {
  return filterMyListings(listings, tab).length
}

// "15 oglasa · 4 aktivna, 1 čeka odobrenje, 1 odbijen, 9 nacrta"
export function formatMyListingsSummary(t, listings) {
  if (!listings.length) return ''
  const parts = SUMMARY_ORDER.map((status) => {
    const count = countMyListings(listings, status)
    return count ? t(`myListings.summary.${status}${srPluralCategory(count)}`, { count }) : ''
  }).filter(Boolean)
  return t('myListings.summaryLine', {
    total: t(`myListings.summary.total${srPluralCategory(listings.length)}`, { count: listings.length }),
    parts: parts.join(', '),
  })
}

function lowerFirst(text) {
  return text ? text.charAt(0).toLocaleLowerCase('sr') + text.slice(1) : ''
}

// What follows the category on the second line: where a live listing is, how far
// a draft got, when it went to review, or why it came back.
function getDetail(t, listing) {
  if (listing.status === 'DRAFT') {
    const total = getWizardSteps(listing.bookingModel).length
    return t('myListings.draftStep', { current: Math.min(listing.wizardStep || 0, total - 1) + 1, total })
  }
  if (listing.status === 'PENDING_APPROVAL') {
    return listing.submittedAt ? t('myListings.submittedOn', { date: formatListingDate(listing.submittedAt) }) : ''
  }
  if (listing.status === 'REJECTED') {
    const { reason, note } = listing.rejection || {}
    // "Drugo" says nothing on its own; the admin's note says what is wrong.
    const text = (reason === 'OTHER' || !reason) && note ? note : reason ? lowerFirst(t(`admin.rejectReasons.${reason}`)) : ''
    return text ? t('myListings.rejectedReason', { reason: text }) : ''
  }
  return [listing.cityName, listing.cityAreaName].filter(Boolean).join(', ')
}

function getPackageCell(t, listing, now) {
  const name = listing.subscription?.package?.key || '-'
  if (!listing.validUntil) return { name, text: '' }
  const date = formatListingDate(listing.validUntil)
  const left = new Date(listing.validUntil).getTime() - now
  if (listing.status === 'EXPIRED' || left <= 0) return { name, text: t('myListings.expiredOn', { date }), urgent: true }
  if (left >= EXPIRING_SOON_MS) return { name, text: t('myListings.expiresOn', { date }) }
  // 380:567: the last week counts down in red.
  const days = belgradeDayNumber(listing.validUntil) - belgradeDayNumber(now)
  let text
  if (days <= 0) text = t('myListings.expiresToday', { date })
  else if (days === 1) text = t('myListings.expiresTomorrow', { date })
  else text = t(`myListings.expiresInDays${srPluralCategory(days)}`, { count: days, date })
  return { name, text, urgent: true }
}

// 380:545: confirmed and completed bookings, then what is still open ("-" for nothing).
function getBookingsCell(t, bookings = {}) {
  const open = []
  if (bookings.requested) {
    open.push(t(`myListings.requested${srPluralCategory(bookings.requested)}`, { count: bookings.requested }))
  }
  if (bookings.awaitingPayment) {
    open.push(t(`myListings.awaitingPayment${srPluralCategory(bookings.awaitingPayment)}`, { count: bookings.awaitingPayment }))
  }
  return { count: String(bookings.confirmed || 0), open }
}

export function buildMyListingRow(t, listing, now = Date.now()) {
  const published = PUBLISHED_STATUSES.includes(listing.status)
  const category = listing.pendingCategoryAssignment ? t('myListings.noCategory') : listing.categoryName
  return {
    id: listing.id,
    status: listing.status,
    live: listing.status === 'ACTIVE',
    published,
    title: listing.title || t('myListings.untitled'),
    cover: listing.coverPhotoUrl,
    meta: [category, getDetail(t, listing)].filter(Boolean).join(' · '),
    statusText: t(STATUS_LABELS[listing.status] || STATUS_LABELS.DRAFT),
    package: published ? getPackageCell(t, listing, now) : { name: '-', text: t('myListings.notPublished') },
    bookings: published ? getBookingsCell(t, listing.bookings) : null,
    editUrl: `/oglasi/${listing.id}/uredi`,
    viewUrl: listing.status === 'ACTIVE' ? `/oglasi/${listing.slug}` : `/oglasi/${listing.id}/pregled`,
    // Dizajn 29: the rejected pill opens the page with the reason.
    rejectedUrl: listing.status === 'REJECTED' ? `/oglasi/${listing.id}/odbijeno` : null,
  }
}
