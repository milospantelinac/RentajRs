// Dizajn 37: what the conversation list (380:959, 519:680) and one open
// conversation (380:998) say, with times read in Belgrade so the server render
// and the browser agree.
import { srPluralCategory } from './pluralize'
import { formatBookingDate, formatBookingDays, formatBookingListing } from './bookingRequests'
import { formatUpcomingTimes } from './upcomingBooking'

const TIME_ZONE = 'Europe/Belgrade'
const DAY_MS = 86_400_000

// poruke.vue hands the open conversation (poruke/[id].vue) its list entry,
// the shared clock and a way to refresh the list.
export const CONVERSATIONS_INBOX = Symbol('conversations-inbox')

// What a message says when it was sent for its attachment alone (T107).
export const ATTACHMENT_ONLY_TEXT = '📎'

const formatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  day: 'numeric',
  month: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

function getParts(value) {
  const parts = Object.fromEntries(formatter.formatToParts(new Date(value)).map((part) => [part.type, part.value]))
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    time: `${parts.hour}:${parts.minute}`,
  }
}

// Whole Belgrade days between the moment's day and today: 0 today, 1 yesterday.
function getDaysAgo(parts, today) {
  return Math.round((Date.UTC(today.year, today.month - 1, today.day) - Date.UTC(parts.year, parts.month - 1, parts.day)) / DAY_MS)
}

// "6. 9." this year, "6. 9. 2025." before it.
function formatDay(parts, today) {
  return parts.year === today.year ? `${parts.day}. ${parts.month}.` : `${parts.day}. ${parts.month}. ${parts.year}.`
}

// 380:966: "10:24" today, "juče", then the day.
export function formatConversationTime(t, value, now = Date.now()) {
  if (!value) return ''
  const parts = getParts(value)
  const today = getParts(now)
  const daysAgo = getDaysAgo(parts, today)
  if (daysAgo <= 0) return parts.time
  if (daysAgo === 1) return t('conversations.yesterday')
  return formatDay(parts, today)
}

// 380:1009: "10:24" under a message sent today; an older one names its day too.
export function formatMessageTime(t, value, now = Date.now()) {
  if (!value) return ''
  const parts = getParts(value)
  const today = getParts(now)
  const daysAgo = getDaysAgo(parts, today)
  if (daysAgo <= 0) return parts.time
  if (daysAgo === 1) return t('conversations.yesterdayAt', { time: parts.time })
  return `${formatDay(parts, today)} ${parts.time}`
}

// A deleted account keeps its conversations but no name (R141).
export function getCounterpartName(t, counterpart) {
  return counterpart?.name && !counterpart.removed ? counterpart.name : t('conversations.removedAccount')
}

// "MJ" for Milica J.; the first and last word of anything else.
export function getCounterpartInitials(t, counterpart) {
  if (counterpart?.initials && !counterpart.removed) return counterpart.initials
  const words = getCounterpartName(t, counterpart).split(/\s+/).filter(Boolean)
  if (!words.length) return ''
  const last = words.length > 1 ? words[words.length - 1] : ''
  return `${words[0].charAt(0)}${last.charAt(0)}`.toUpperCase()
}

// The row's last line: the latest message, or the file it carried alone.
export function formatMessagePreview(t, message) {
  if (!message) return ''
  if (message.attachment && (!message.text || message.text === ATTACHMENT_ONLY_TEXT)) {
    return t('conversations.attachmentPreview', { name: message.attachment })
  }
  return message.text || ''
}

// 380:960: one conversation in the list. The open one reads as read, since
// opening it marks it so.
export function buildConversationRow(t, conversation, { activeId = null, now = Date.now() } = {}) {
  const active = conversation.id === activeId
  const { counterpart } = conversation
  return {
    id: conversation.id,
    to: `/kontrolna-tabla/poruke/${conversation.id}`,
    active,
    unread: !active && conversation.unreadCount > 0,
    name: getCounterpartName(t, counterpart),
    initials: getCounterpartInitials(t, counterpart),
    avatarUrl: (!counterpart?.removed && counterpart?.avatarUrl) || '',
    listing: formatBookingListing(conversation.listing),
    preview: formatMessagePreview(t, conversation.lastMessage),
    time: formatConversationTime(t, conversation.lastMessage?.sentAt, now),
    sentAt: conversation.lastMessage?.sentAt || '',
  }
}

// 380:957: "2 nepročitane poruke", counting messages; the open conversation
// has none left. Nothing while there is no conversation at all.
export function formatConversationsSummary(t, conversations, activeId = null) {
  if (!conversations?.length) return ''
  const count = conversations.reduce((sum, c) => sum + (c.id === activeId ? 0 : c.unreadCount || 0), 0)
  return count ? t(`conversations.summary${srPluralCategory(count)}`, { count }) : t('conversations.summaryNone')
}

// "12. 9. 2026. 16:00 - 18:00" for a booking by hours, "8. 10. - 11. 10. 2026."
// for one by whole days.
export function formatConversationBookingTerm(booking) {
  const times = formatUpcomingTimes(booking)
  return times ? `${formatBookingDate(booking.startsAt)} ${times}` : formatBookingDays(booking.startsAt, booking.endsAt)
}

// 380:999: who the conversation is with, "listing - area" and the term when
// the two have a booking of it, and a button to that booking named the way
// each side's menu names it.
export function buildConversationHeader(t, conversation) {
  const { booking } = conversation
  return {
    name: getCounterpartName(t, conversation.counterpart),
    listing: formatBookingListing(conversation.listing),
    term: booking ? formatConversationBookingTerm(booking) : '',
    action: booking
      ? {
          to: `/rezervacije/${booking.id}`,
          label: t(conversation.role === 'owner' ? 'conversations.openRequest' : 'conversations.openBooking'),
        }
      : null,
  }
}

// 380:1006 and 380:1010: the other side's messages on the left, mine on the
// right, each with its time. A message sent for its file alone shows the file.
export function buildMessageBubbles(t, messages, now = Date.now()) {
  return (messages || []).map((message) => {
    const attachments = (message.attachments || []).map((file) => ({
      id: file.id,
      url: file.url,
      name: file.filename,
      image: String(file.type || '').startsWith('image/'),
    }))
    return {
      id: message.id,
      mine: !!message.mine,
      text: attachments.length && message.text === ATTACHMENT_ONLY_TEXT ? '' : message.text,
      attachments,
      time: formatMessageTime(t, message.sentAt, now),
      sentAt: message.sentAt,
    }
  })
}

// Whether the list knows of a message newer than the last one the open
// conversation shows.
export function hasNewerMessage(entry, messages) {
  const listed = entry?.lastMessage?.sentAt
  if (!listed) return false
  const shown = messages?.length ? messages[messages.length - 1].sentAt : null
  return !shown || new Date(listed).getTime() > new Date(shown).getTime()
}
