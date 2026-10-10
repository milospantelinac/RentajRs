// Dizajn 45: one list of admin menu entries, read by the sidebar card
// (AdminNav) and by the phone strip (AdminTabs), grouped the way the
// dashboard menu groups its own (Dizajn 30, frame 357:444). The panel has no
// frames of its own, so the entries keep the labels and the order they
// already had; only the shape around them is new.
//
// `icon` goes through DashboardNavIcon: bookings, packages and home are the
// dashboard's real Figma exports, the rest are Font Awesome glyphs, the same
// way the "Administracija" entry itself has always been drawn.
export const ADMIN_NAV_GROUPS = [
  { key: 'queue', items: [{ to: '/admin', labelKey: 'admin.queue', icon: 'queue' }] },
  {
    key: 'moderation',
    titleKey: 'admin.sectionModeration',
    items: [
      { to: '/admin/sporovi', labelKey: 'admin.disputes', icon: 'disputes' },
      { to: '/admin/kategorije', labelKey: 'admin.categories', icon: 'categories' },
      { to: '/admin/lokacije', labelKey: 'admin.locations', icon: 'locations' },
      { to: '/admin/rezervacioni-modeli', labelKey: 'admin.bookingModels', icon: 'models' },
      { to: '/admin/korisnici', labelKey: 'admin.users', icon: 'users' },
    ],
  },
  {
    key: 'operations',
    titleKey: 'admin.sectionOperations',
    items: [
      { to: '/admin/rezervacije', labelKey: 'admin.bookings', icon: 'bookings' },
      { to: '/admin/pretplate', labelKey: 'admin.subscriptions', icon: 'packages' },
      { to: '/admin/placanje', labelKey: 'admin.paymentSettings', icon: 'payments' },
    ],
  },
  {
    key: 'content',
    titleKey: 'admin.sectionContent',
    items: [
      { to: '/admin/sadrzaj', labelKey: 'admin.content', icon: 'content' },
      { to: '/admin/email-sabloni', labelKey: 'admin.emailTemplates', icon: 'emails' },
      { to: '/admin/podesavanja', labelKey: 'admin.settings', icon: 'settings' },
    ],
  },
]

/** The way back out of the panel, set apart at the foot of the menu card. */
export const ADMIN_NAV_BACK = { to: '/kontrolna-tabla', labelKey: 'nav.dashboard', icon: 'home' }

export const ADMIN_NAV_ITEMS = ADMIN_NAV_GROUPS.flatMap((group) => group.items)

const ADMIN_HOME = '/admin'

/** Like the dashboard's rule: an entry stays current on the pages below it, except the queue, which every other admin page sits below. */
export function isAdminLinkActive(route, to) {
  return route.path === to || (to !== ADMIN_HOME && route.path.startsWith(`${to}/`))
}
