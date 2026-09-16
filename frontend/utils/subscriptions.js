// Dizajn 35: what "Moje pretplate" (frame 380:1219) says about each package an
// owner bought and about the live listings that can move to Pro, with dates
// read in Belgrade time so the server render and the browser agree.
import { srPluralCategory } from './pluralize'
import { belgradeDayNumber, formatListingDate } from './myListings'
import { formatBookingListing, formatRsd } from './bookingRequests'

const DAY_MS = 86_400_000
// The week the home page's "subscription_expiring" task and Moji oglasi count down in.
const EXPIRING_SOON_MS = 7 * DAY_MS

// SubscriptionsService starts a package for 30 or 365 days.
const CYCLE_DAYS = { MONTHLY: 30, YEARLY: 365 }

const STATUS_KEYS = {
  ACTIVE: 'Active',
  PENDING_ACTIVATION: 'PendingActivation',
  AWAITING_PAYMENT: 'AwaitingPayment',
  EXPIRED: 'Expired',
  CANCELLED: 'Cancelled',
}

// Running packages first, then the ones still waiting, then expired ones that
// still hold a listing. Cancelled and replaced packages cover nothing any more.
const SHOWN_STATUSES = ['ACTIVE', 'PENDING_ACTIVATION', 'AWAITING_PAYMENT', 'EXPIRED']

// The ?payment= outcomes SubscriptionsService sends the owner back with; "unknown"
// is a repeated bank callback and needs no message.
const PAYMENT_NOTICES = {
  failed: { key: 'failed', tone: 'danger', contact: 'charged' },
  invalid: { key: 'invalid', tone: 'danger', contact: 'charged' },
  'verify-email': { key: 'verifyEmail', tone: 'warning', contact: 'verify' },
}

const toTime = (value) => (value ? new Date(value).getTime() : null)

function compareTimes(a, b, missing) {
  return (a ?? missing) - (b ?? missing) || 0
}

function compareSubscriptions(a, b) {
  const byStatus = SHOWN_STATUSES.indexOf(a.status) - SHOWN_STATUSES.indexOf(b.status)
  if (byStatus) return byStatus
  // The package that ends soonest is the one to look at first.
  if (a.status === 'ACTIVE') return compareTimes(toTime(a.expiresAt), toTime(b.expiresAt), Number.MAX_SAFE_INTEGER)
  if (a.status === 'EXPIRED') return compareTimes(toTime(b.expiresAt), toTime(a.expiresAt), 0)
  return compareTimes(toTime(b.createdAt), toTime(a.createdAt), 0)
}

export function selectShownSubscriptions(subscriptions) {
  return subscriptions
    .filter((subscription) => SHOWN_STATUSES.includes(subscription.status))
    .filter((subscription) => subscription.status !== 'EXPIRED' || subscription.listings?.length)
    .sort(compareSubscriptions)
}

export function getSubscriptionStatusLabel(t, status) {
  return t(`billing.status${STATUS_KEYS[status] || STATUS_KEYS.ACTIVE}`)
}

// The listing page for a live listing, the owner's preview for anything else (as in Moji oglasi).
function getListingUrl(listing) {
  return listing.status === 'ACTIVE' && listing.slug ? `/oglasi/${listing.slug}` : `/oglasi/${listing.id}/pregled`
}

function describeListing(t, listing) {
  return {
    id: listing.id,
    text: formatBookingListing({
      title: listing.title || t('myListings.untitled'),
      place: listing.cityAreaName || listing.cityName || '',
    }),
    url: getListingUrl(listing),
  }
}

// ADR-005: days carried over from an earlier package. They start counting when this
// package ends (validUntil is set then), so a listing that has some stays online.
function getBankedRow(t, bankedDays, now) {
  const running = bankedDays.filter((row) => row.validUntil && toTime(row.validUntil) > now)
  if (running.length) {
    const until = Math.max(...running.map((row) => toTime(row.validUntil)))
    return t('mySubscriptions.bankedUntil', { date: formatListingDate(until) })
  }
  const days = bankedDays.filter((row) => !row.validUntil).reduce((sum, row) => sum + row.days, 0)
  return days ? t(`mySubscriptions.bankedPending${srPluralCategory(days)}`, { count: days }) : ''
}

function getExpiryWhen(t, expiresAt, now) {
  const days = belgradeDayNumber(expiresAt) - belgradeDayNumber(now)
  if (days <= 0) return t('mySubscriptions.when.today')
  if (days === 1) return t('mySubscriptions.when.tomorrow')
  return t(`mySubscriptions.when.days${srPluralCategory(days)}`, { count: days })
}

// 380:1348: the last week of a package that takes listings offline when it ends.
function getWarning(t, subscription, listings, bankedDays, now) {
  if (subscription.status !== 'ACTIVE' || !subscription.expiresAt || !listings.length) return ''
  const left = toTime(subscription.expiresAt) - now
  if (left >= EXPIRING_SOON_MS) return ''
  const waiting = new Set(bankedDays.filter((row) => !row.validUntil && row.days > 0).map((row) => row.listingId))
  const offline = listings.filter((listing) => !waiting.has(listing.id))
  if (!offline.length) return ''
  const scope = offline.length < listings.length ? 'Some' : listings.length > 1 ? 'Many' : 'One'
  // The daily sweep takes the listing down a few hours after the moment itself.
  if (left <= 0) return t(`mySubscriptions.expiredWarning${scope}`)
  return t(`mySubscriptions.warning${scope}`, { when: getExpiryWhen(t, subscription.expiresAt, now) })
}

export function buildSubscriptionCard(t, subscription, listingsById, now = Date.now()) {
  const { status } = subscription
  const pkg = subscription.package || {}
  const limit = pkg.listingLimit || 1
  const attached = subscription.listings || []
  // Moji oglasi's rows carry the place; an unfinished checkout names the listing it was started for.
  const listings =
    status === 'AWAITING_PAYMENT'
      ? [listingsById.get(subscription.pendingListingId)].filter(Boolean)
      : attached.map((listing) => listingsById.get(listing.id) || listing)
  const bankedDays = subscription.bankedDays || []
  const warning = getWarning(t, subscription, listings, bankedDays, now)
  const cycleDays = CYCLE_DAYS[subscription.billingCycle] || CYCLE_DAYS.MONTHLY

  let end = null
  if (status === 'ACTIVE' && subscription.expiresAt) {
    end = { label: t('billing.expiresOn'), value: formatListingDate(subscription.expiresAt), urgent: !!warning }
  } else if (status === 'EXPIRED' && subscription.expiresAt) {
    end = { label: t('mySubscriptions.expiredLabel'), value: formatListingDate(subscription.expiresAt) }
  }

  const described = listings.map((listing) => describeListing(t, listing))
  const statusText = getSubscriptionStatusLabel(t, status)

  return {
    id: subscription.id,
    status,
    // The card's name for screen readers: "STANDARD, Aktivna, Sala za proslave - Zvezdara".
    label: [pkg.key, statusText, ...described.map((listing) => listing.text)].filter(Boolean).join(', '),
    packageKey: pkg.key || '',
    statusText,
    price: formatRsd(subscription.priceAtPurchase),
    listingsLabel: t(limit > 1 ? 'mySubscriptions.listingsLabel' : 'mySubscriptions.listingLabel'),
    listings: described,
    // A package with room for several listings shows how many it holds (2 od 4)
    // while those places can still be used.
    usage:
      limit > 1 && ['ACTIVE', 'PENDING_ACTIVATION'].includes(status)
        ? { used: attached.length, limit, percent: Math.min(100, Math.round((attached.length / limit) * 100)) }
        : null,
    duration: t(`mySubscriptions.days${srPluralCategory(cycleDays)}`, { count: cycleDays }),
    end,
    banked: getBankedRow(t, bankedDays, now),
    warning,
    danger: !!warning,
    deletable: status === 'AWAITING_PAYMENT',
  }
}

// "4 aktivne pretplate · dve ističu ove nedelje"
export function formatSubscriptionsSummary(t, cards) {
  const count = (status) => cards.filter((card) => card.status === status).length
  const parts = []
  const active = count('ACTIVE')
  if (active) parts.push(t(`mySubscriptions.summary.active${srPluralCategory(active)}`, { count: active }))
  const expiring = cards.filter((card) => card.danger).length
  if (expiring) {
    // 380:1310 writes the few in words.
    const word = t('mySubscriptions.summary.countWords').split(',')[expiring - 1] || String(expiring)
    parts.push(t(`mySubscriptions.summary.expiring${srPluralCategory(expiring)}`, { count: word }))
  }
  for (const [status, key] of [
    ['PENDING_ACTIVATION', 'pending'],
    ['AWAITING_PAYMENT', 'awaiting'],
    ['EXPIRED', 'expired'],
  ]) {
    const n = count(status)
    if (n) parts.push(t(`mySubscriptions.summary.${key}${srPluralCategory(n)}`, { count: n }))
  }
  return parts.join(' · ')
}

// ADR-005: a live listing not yet on Pro can move to it from here.
export function selectUpgradeableListings(listings) {
  return listings.filter((listing) => listing.status === 'ACTIVE' && listing.subscription?.package?.key !== 'PRO')
}

// 380:1391: "Igraonica Balončići - Vračar" over "Igraonice · STANDARD".
export function buildUpgradeRow(t, listing) {
  return {
    id: listing.id,
    title: describeListing(t, listing).text,
    meta: [listing.categoryName, listing.subscription?.package?.key].filter(Boolean).join(' · '),
    upgradeUrl: `/oglasi/${listing.id}/paket`,
  }
}

export function getPaymentNotice(query) {
  if (query.upgraded === '1') return { key: 'upgraded', tone: 'success', contact: null }
  return PAYMENT_NOTICES[query.payment] || null
}
