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
  SCHEDULED: 'Scheduled',
  PENDING_ACTIVATION: 'PendingActivation',
  AWAITING_PAYMENT: 'AwaitingPayment',
  EXPIRED: 'Expired',
  CANCELLED: 'Cancelled',
}

// Running packages first (a paid next period right after the one it continues),
// then the ones still waiting, then expired ones that still hold a listing.
// Cancelled and replaced packages cover nothing any more.
const STATUS_RANK = { ACTIVE: 0, SCHEDULED: 0, PENDING_ACTIVATION: 1, AWAITING_PAYMENT: 2, EXPIRED: 3 }

// Packages the owner pays the next period of (SubscriptionsService.initCheckout).
const RENEWABLE_STATUSES = ['ACTIVE', 'EXPIRED']

// The ?payment= and ?renewed= outcomes SubscriptionsService sends the owner back
// with; "unknown" is a repeated bank callback and needs no message.
const PAYMENT_NOTICES = {
  failed: { key: 'failed', tone: 'danger', contact: 'charged' },
  invalid: { key: 'invalid', tone: 'danger', contact: 'charged' },
  'verify-email': { key: 'verifyEmail', tone: 'warning', contact: 'verify' },
}
const RENEWAL_NOTICES = {
  scheduled: { key: 'renewedScheduled', tone: 'success', contact: null },
  active: { key: 'renewedActive', tone: 'success', contact: null },
}

const toTime = (value) => (value ? new Date(value).getTime() : null)

function compareTimes(a, b, missing) {
  return (a ?? missing) - (b ?? missing) || 0
}

// Where a running package ends, or where a paid next period starts: the same moment.
const periodKey = (subscription) => toTime(subscription.status === 'SCHEDULED' ? subscription.startsAt : subscription.expiresAt)

function compareSubscriptions(a, b) {
  const byStatus = STATUS_RANK[a.status] - STATUS_RANK[b.status]
  if (byStatus) return byStatus
  // The package that ends soonest is the one to look at first.
  if (STATUS_RANK[a.status] === 0) {
    return compareTimes(periodKey(a), periodKey(b), Number.MAX_SAFE_INTEGER) || (a.status === 'ACTIVE' ? -1 : 0) - (b.status === 'ACTIVE' ? -1 : 0)
  }
  if (a.status === 'EXPIRED') return compareTimes(toTime(b.expiresAt), toTime(a.expiresAt), 0)
  return compareTimes(toTime(b.createdAt), toTime(a.createdAt), 0)
}

export function selectShownSubscriptions(subscriptions) {
  return subscriptions
    .filter((subscription) => subscription.status in STATUS_RANK)
    .filter((subscription) => subscription.status !== 'EXPIRED' || subscription.listings?.length)
    .sort(compareSubscriptions)
}

export function getSubscriptionStatusLabel(t, status) {
  return t(`billing.status${STATUS_KEYS[status] || STATUS_KEYS.ACTIVE}`)
}

// The renewal page of a package lives under one of its listings.
export function getRenewalUrl(subscriptionId, listingId) {
  return `/oglasi/${listingId}/paket?obnova=${subscriptionId}`
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
function getRunningBanked(bankedDays, now) {
  return bankedDays.filter((row) => row.validUntil && toTime(row.validUntil) > now)
}

function getBankedRow(t, bankedDays, now) {
  const running = getRunningBanked(bankedDays, now)
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

// A paid next period takes over the listings of the package it continues.
function findRenewedHead(subscription, byId) {
  let head = subscription
  for (let depth = 0; head?.status === 'SCHEDULED' && depth < 100; depth++) head = byId.get(head.renewsSubscriptionId)
  return head || subscription
}

// The strip under the facts: the frame's warning, and what renewing means for the rest.
function getNote(t, { subscription, renewal, listings, bankedDays, now, renewUrl }) {
  const renew = renewUrl ? { label: t('billing.renewAction'), to: renewUrl } : null
  if (subscription.status === 'ACTIVE') {
    if (renewal) {
      return { tone: 'success', text: t('mySubscriptions.renewedNote', { date: formatListingDate(renewal.startsAt) }) }
    }
    const warning = getWarning(t, subscription, listings, bankedDays, now)
    return warning ? { tone: 'danger', text: warning, action: renew } : null
  }
  if (subscription.status === 'EXPIRED' && listings.length) {
    if (getRunningBanked(bankedDays, now).length) return { tone: 'muted', text: t('mySubscriptions.expiredBankedNote'), action: renew }
    return { tone: 'danger', text: t(`mySubscriptions.expiredNote${listings.length > 1 ? 'Many' : 'One'}`), action: renew }
  }
  return null
}

export function buildSubscriptionCard(t, subscription, listingsById, now = Date.now(), all = [subscription]) {
  const { status } = subscription
  const byId = new Map(all.map((item) => [item.id, item]))
  const pkg = subscription.package || {}
  const limit = pkg.listingLimit || 1
  // A paid next period shows the listings it will take over.
  const holder = status === 'SCHEDULED' ? findRenewedHead(subscription, byId) : subscription
  const attached = holder.listings || []
  // Moji oglasi's rows carry the place; an unfinished checkout names the listing it was started for.
  const listings =
    status === 'AWAITING_PAYMENT'
      ? [listingsById.get(subscription.pendingListingId)].filter(Boolean)
      : attached.map((listing) => listingsById.get(listing.id) || listing)
  const bankedDays = subscription.bankedDays || []
  const renewal = all.find((item) => item.status === 'SCHEDULED' && item.renewsSubscriptionId === subscription.id)
  const cycleDays = CYCLE_DAYS[subscription.billingCycle] || CYCLE_DAYS.MONTHLY
  const renewUrl =
    RENEWABLE_STATUSES.includes(status) && listings.length && !renewal ? getRenewalUrl(subscription.id, listings[0].id) : null
  const note = getNote(t, { subscription, renewal, listings, bankedDays, now, renewUrl })

  const dates = []
  if (status === 'ACTIVE' && subscription.expiresAt) {
    dates.push({ label: t('billing.expiresOn'), value: formatListingDate(subscription.expiresAt), urgent: note?.tone === 'danger' })
  } else if (status === 'SCHEDULED') {
    dates.push({ label: t('mySubscriptions.startsLabel'), value: formatListingDate(subscription.startsAt) })
    dates.push({ label: t('billing.expiresOn'), value: formatListingDate(subscription.expiresAt) })
  } else if (status === 'EXPIRED' && subscription.expiresAt) {
    dates.push({ label: t('mySubscriptions.expiredLabel'), value: formatListingDate(subscription.expiresAt) })
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
      limit > 1 && ['ACTIVE', 'SCHEDULED', 'PENDING_ACTIVATION'].includes(status)
        ? { used: attached.length, limit, percent: Math.min(100, Math.round((attached.length / limit) * 100)) }
        : null,
    duration: t(`mySubscriptions.days${srPluralCategory(cycleDays)}`, { count: cycleDays }),
    dates,
    banked: getBankedRow(t, bankedDays, now),
    note,
    danger: note?.tone === 'danger' && status === 'ACTIVE',
    deletable: status === 'AWAITING_PAYMENT',
  }
}

export function buildSubscriptionCards(t, subscriptions, listingsById, now = Date.now()) {
  return selectShownSubscriptions(subscriptions).map((subscription) =>
    buildSubscriptionCard(t, subscription, listingsById, now, subscriptions),
  )
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
    ['SCHEDULED', 'scheduled'],
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
  return RENEWAL_NOTICES[query.renewed] || PAYMENT_NOTICES[query.payment] || null
}

// "Sala za proslave - Zvezdara, Kombi za selidbe - Novi Beograd"
export function formatRenewalListings(t, listings) {
  return listings.map((listing) => formatBookingListing({ title: listing.title || t('myListings.untitled'), place: listing.place || '' })).join(', ')
}

/**
 * The three ways /oglasi/:id/paket and its checkout are reached: a first package
 * before publishing, a live listing moving up to Pro, or a renewal (?obnova=).
 */
export function getPackagePurchaseMode(listing, renewal) {
  if (renewal) return 'renew'
  return listing?.status === 'ACTIVE' ? 'upgrade' : 'publish'
}

// What the renewal page and its checkout say about when the new period starts.
export function getRenewalCopy(t, renewal) {
  const scope = renewal.listings.length > 1 ? 'Many' : 'One'
  const date = renewal.startsAt ? formatListingDate(renewal.startsAt) : ''
  return {
    subtitle: renewal.startsAt ? t(`billing.renewSubtitleScheduled${scope}`, { date }) : t(`billing.renewSubtitleNow${scope}`),
    afterPayment: renewal.startsAt ? t('billing.renewAfterPaymentScheduled', { date }) : t('billing.renewAfterPaymentNow'),
    covers: t(`billing.renewCovers${scope}`, { listings: formatRenewalListings(t, renewal.listings) }),
    forListing: t(`billing.renewForListing${scope}`),
    listings: formatRenewalListings(t, renewal.listings),
  }
}
