import { library, config } from '@fortawesome/fontawesome-svg-core'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import {
  faHouse,
  faList,
  faInbox,
  faCreditCard,
  faCalendarDays,
  faHeart,
  faCommentDots,
  faGear,
  faShieldHalved,
  faEllipsis,
  faBars,
  faXmark,
  faMagnifyingGlass,
  faSliders,
  faPlus,
  faPen,
  faPaperclip,
} from '@fortawesome/free-solid-svg-icons'
import '@fortawesome/fontawesome-svg-core/styles.css'

// We size/color every icon ourselves via the wrapping element (see
// DashboardNavIcon.vue) — auto-injecting FA's own CSS would fight that.
config.autoAddCss = false

library.add(
  faHouse,
  faList,
  faInbox,
  faCreditCard,
  faCalendarDays,
  faHeart,
  faCommentDots,
  faGear,
  faShieldHalved,
  faEllipsis,
  faBars,
  faXmark,
  faMagnifyingGlass,
  faSliders,
  faPlus,
  faPen,
  faPaperclip,
)

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.component('FontAwesomeIcon', FontAwesomeIcon)
})
