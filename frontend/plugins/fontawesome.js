import { library, config } from '@fortawesome/fontawesome-svg-core'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
// Dizajn 30: the dashboard menu draws its own Figma icons now, so of its old
// glyphs only the admin panel's shield and the bottom bar's "Više" are left.
// Dizajn 45: the admin menu's own entries have no Figma icons either, so they
// are drawn the same way (utils/adminNav.js names them).
import {
  faShieldHalved,
  faEllipsis,
  faBars,
  faXmark,
  faMagnifyingGlass,
  faSliders,
  faPlus,
  faPen,
  faPaperclip,
  faArrowsRotate,
  faLockOpen,
  faClipboardCheck,
  faTriangleExclamation,
  faSitemap,
  faLocationDot,
  faUsers,
  faCreditCard,
  faFileLines,
  faEnvelope,
  faGear,
} from '@fortawesome/free-solid-svg-icons'
import '@fortawesome/fontawesome-svg-core/styles.css'

// We size/color every icon ourselves via the wrapping element (see
// DashboardNavIcon.vue) — auto-injecting FA's own CSS would fight that.
config.autoAddCss = false

library.add(
  faShieldHalved,
  faEllipsis,
  faBars,
  faXmark,
  faMagnifyingGlass,
  faSliders,
  faPlus,
  faPen,
  faPaperclip,
  faArrowsRotate,
  faLockOpen,
  faClipboardCheck,
  faTriangleExclamation,
  faSitemap,
  faLocationDot,
  faUsers,
  faCreditCard,
  faFileLines,
  faEnvelope,
  faGear,
)

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.component('FontAwesomeIcon', FontAwesomeIcon)
})
