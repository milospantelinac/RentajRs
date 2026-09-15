<template>
  <div class="category-pick" :class="{ 'category-pick-propose': step === 'propose' || step === 'submitted' }">
    <div class="container">
      <template v-if="step === 'top'">
        <header class="category-pick-hero">
          <p class="category-pick-eyebrow">{{ t(changingListingId ? 'listing.changeCategoryEyebrow' : 'listing.newListingEyebrow') }}</p>
          <h1 class="category-pick-title">{{ t('listing.categoryPickTitle') }}</h1>
          <p class="category-pick-subtitle">{{ t('listing.categoryPickSubtitle') }}</p>
        </header>
        <p v-if="error" class="form-error mb-3">{{ error }}</p>

        <div class="category-pick-grid">
          <button
            v-for="cat in orderedCategories"
            :key="cat.id"
            type="button"
            class="category-card"
            @click="selectTopCategory(cat)"
          >
            <span class="category-card-icon" aria-hidden="true" v-html="iconMarkup(cat.slug)" />
            <span class="category-card-text">
              <span class="category-card-name">{{ cat.name }}</span>
              <span v-if="cat.shortDescription" class="category-card-desc">{{ cat.shortDescription }}</span>
            </span>
          </button>
          <!-- T60 — "Ostalo" isn't a real category to pick (it's the internal
               fallback createUncategorizedListing uses), so this tile is fixed
               UI, not driven by the categories list — it never leaks as a
               selectable category, here or in /pretraga's chips. -->
          <button v-if="!changingListingId" type="button" class="category-card category-card-unlock" @click="step = 'propose'">
            <span class="category-card-unlock-icon" aria-hidden="true">
              <img src="/images/icons/plus-brand.svg" alt="" />
            </span>
            <span class="category-card-text">
              <span class="category-card-name">{{ t('listing.unlockYourCategory') }}</span>
              <span class="category-card-desc">{{ t('listing.unlockYourCategoryHint') }}</span>
            </span>
          </button>
        </div>
      </template>

      <!-- No frame of its own — same header and cards as the category step,
           under the parent category's icon. -->
      <template v-else-if="step === 'sub'">
        <header class="category-pick-hero">
          <p class="category-pick-eyebrow">{{ t(changingListingId ? 'listing.changeCategoryEyebrow' : 'listing.newListingEyebrow') }}</p>
          <h1 class="category-pick-title">{{ activeTopCategory.name }}</h1>
          <p class="category-pick-subtitle">{{ t('listing.chooseSubcategory') }}</p>
        </header>
        <p v-if="error" class="form-error mb-3">{{ error }}</p>

        <div class="category-pick-grid">
          <button
            v-for="sub in activeTopCategory.children"
            :key="sub.id"
            type="button"
            class="category-card"
            @click="selectLeafCategory(sub.id)"
          >
            <span class="category-card-icon" aria-hidden="true" v-html="iconMarkup(activeTopCategory.slug)" />
            <span class="category-card-text">
              <span class="category-card-name">{{ sub.name }}</span>
              <span v-if="sub.shortDescription" class="category-card-desc">{{ sub.shortDescription }}</span>
            </span>
          </button>
        </div>
      </template>

      <!-- Kategorije spec §8 — the owner doesn't pick a category or even name
           one; they describe the listing and Rentaj assigns the real category
           afterward from the moderation queue. -->
      <div v-else-if="step === 'propose'" class="propose">
        <header class="propose-head">
          <p class="propose-eyebrow">{{ t('listing.proposeCategoryEyebrow') }}</p>
          <h1 class="propose-title">{{ t('listing.unlockYourCategory') }}</h1>
          <p class="propose-subtitle">{{ t('listing.proposeCategoryExplain') }}</p>
        </header>

        <form class="propose-form" @submit.prevent="submitUncategorized" @invalid.capture="onInvalid" @input.capture="onInput">
          <div class="propose-field">
            <label for="propose-title" class="propose-label">{{ t('listing.title') }}<span class="propose-required">*</span></label>
            <input
              id="propose-title"
              v-model="uncategorized.title"
              name="title"
              type="text"
              class="propose-input"
              :class="{ 'is-invalid': fieldErrors.title }"
              :placeholder="t('listing.proposeTitlePlaceholder')"
              required
              maxlength="70"
            />
            <p v-if="fieldErrors.title" class="propose-error"><img src="/images/icons/field-error.svg" alt="" />{{ fieldErrors.title }}</p>
          </div>

          <div class="propose-field propose-options" role="radiogroup" aria-labelledby="propose-booking-label">
            <p id="propose-booking-label" class="propose-label">{{ t('listing.reservationMethod') }}<span class="propose-required">*</span></p>
            <label
              v-for="option in bookingOptions"
              :key="option.value"
              class="propose-option"
              :class="{ 'is-selected': uncategorized.bookingModel === option.value }"
            >
              <input v-model="uncategorized.bookingModel" type="radio" name="bookingModel" :value="option.value" class="propose-radio" />
              <span class="propose-option-text">
                <span class="propose-option-title">{{ option.label }}</span>
                <span class="propose-option-hint">{{ option.hint }}</span>
              </span>
            </label>
          </div>

          <div v-if="uncategorized.bookingModel !== 'NO_BOOKING'" class="propose-field">
            <label for="propose-unit" class="propose-label">{{ t('listing.priceUnit') }}<span class="propose-required">*</span></label>
            <select id="propose-unit" v-model="uncategorized.priceUnit" name="priceUnit" class="propose-input propose-select" required>
              <template v-if="uncategorized.bookingModel === 'PER_STAY'">
                <option value="DAY">{{ t('listing.unitDay') }}</option>
                <option value="NIGHT">{{ t('listing.unitNight') }}</option>
                <option value="MONTH">{{ t('listing.unitMonth') }}</option>
              </template>
              <template v-else>
                <option value="HOUR">{{ t('listing.unitHour') }}</option>
                <option value="SLOT">{{ t('listing.unitSlot') }}</option>
              </template>
            </select>
            <p class="propose-hint">{{ t('listing.proposePriceUnitHint') }}</p>
          </div>

          <div class="propose-field">
            <label for="propose-description" class="propose-label">{{ t('listing.proposeCategoryComment') }}<span class="propose-optional">{{ t('common.optional') }}</span></label>
            <textarea
              id="propose-description"
              v-model="uncategorized.description"
              name="description"
              class="propose-input propose-textarea"
              :placeholder="t('listing.proposeDescriptionPlaceholder')"
              maxlength="1200"
            />
          </div>

          <div class="propose-note">
            <img src="/images/icons/info-circle.svg" alt="" />
            <p>{{ t('listing.proposeCategoryNote') }}</p>
          </div>

          <p v-if="error" class="propose-error" role="alert"><img src="/images/icons/field-error.svg" alt="" />{{ error }}</p>

          <div class="propose-divider" />

          <div class="propose-actions">
            <button type="submit" class="propose-submit" :disabled="submitting">
              {{ submitting ? t('common.loading') : t('listing.proposeCategorySubmit') }}
            </button>
            <button type="button" class="propose-cancel" @click="leavePropose">{{ t('common.cancel') }}</button>
          </div>
        </form>
      </div>

      <!-- No frame of its own — 514:514's heading above the dashboard link. -->
      <div v-else-if="step === 'submitted'" class="propose">
        <header class="propose-head">
          <p class="propose-eyebrow">{{ t('listing.proposeCategoryEyebrow') }}</p>
          <h1 class="propose-title">{{ t('listing.proposeCategorySubmittedTitle') }}</h1>
          <p class="propose-subtitle">{{ t('listing.proposeCategorySubmittedMessage') }}</p>
        </header>
        <div class="propose-actions">
          <NuxtLink to="/kontrolna-tabla" class="propose-submit">{{ t('nav.dashboard') }}</NuxtLink>
        </div>
      </div>

      <!-- 176:287 — "Odustani" under the categories. The subcategory step gets
           the wizard's matching "Nazad" (228:378) back to the categories. -->
      <div v-if="step === 'top' || step === 'sub'" class="category-pick-actions">
        <button v-if="step === 'top'" type="button" class="category-pick-back" @click="cancel">
          <img src="/images/icons/arrow-left.svg" alt="" />
          {{ t('listing.cancelNewListing') }}
        </button>
        <button v-else type="button" class="category-pick-back" @click="step = 'top'">
          <img src="/images/icons/arrow-left.svg" alt="" />
          {{ t('listing.back') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
// Dizajn 17 (Figma "Izbor kategorije — pre wizarda · Desktop 1440", node
// 172:287). The category list, the subcategory step and what a pick does are
// unchanged; the frame adds the card descriptions and "Odustani".
// Dizajn 18 ("Otključaj svoju kategoriju · Desktop 1440", node 514:514) is the
// propose step. What a submitted proposal does is unchanged.
definePageMeta({ middleware: 'auth' })
const { t } = useI18n()
const api = useApi()
const router = useRouter()
const route = useRoute()
const { fieldErrors, onInvalid, onInput } = useInlineFormValidation()
const error = ref('')
const submitting = ref(false)
const step = ref('top')
const activeTopCategory = ref(null)

// Dizajn 19: "Promeni kategoriju" in the wizard opens this page for a draft
// (?oglas=<id>). A pick then moves that draft to the new category instead of
// creating a listing, and the "Otključaj svoju kategoriju" tile stays hidden.
const changingListingId = computed(() => (typeof route.query.oglas === 'string' ? route.query.oglas : ''))

const { data: categories } = await useAsyncData('wizard-categories', () => api.get('/categories'))

// The frame puts Magacini i skladišta before Građevinske mašine — the search
// tiles' order, and the reverse of the endpoint's displayOrder.
const orderedCategories = computed(() => sortSearchCategories(categories.value || []))

const iconMarkup = (slug) => getWizardCategoryIconMarkup(slug)

// 651:1085 — "dan" is the unit the frame shows for Po boravku.
const uncategorized = reactive({ title: '', bookingModel: 'PER_STAY', priceUnit: 'DAY', description: '' })
watch(
  () => uncategorized.bookingModel,
  (val) => {
    uncategorized.priceUnit = val === 'PER_STAY' ? 'DAY' : val === 'PER_SLOT' ? 'HOUR' : ''
  },
)

// 651:1062
const bookingOptions = computed(() => [
  { value: 'PER_STAY', label: t('booking.byStay'), hint: t('listing.proposeByStayHint') },
  { value: 'PER_SLOT', label: t('booking.bySlot'), hint: t('listing.proposeBySlotHint') },
  { value: 'NO_BOOKING', label: t('listing.bookingModelNone'), hint: t('listing.proposeNoBookingHint') },
])

// Back to the draft's wizard: through history when the owner came from there,
// so the picker doesn't stay behind it.
function returnToWizard(listingId) {
  const wizardPath = `/oglasi/${listingId}/uredi`
  if (window.history.state?.back?.endsWith(wizardPath)) {
    router.back()
  } else {
    router.replace(wizardPath)
  }
}

// "Odustani" returns to wherever the owner clicked "Dodaj oglas", with the
// same history check BackLink uses. Moji oglasi is the fallback when there's
// no in-app page to go back to (a direct link, a new tab) and when that page
// is part of signing in: a logged-out owner reaches this page through
// /prijava, and going back there would show the login form to someone who is
// already logged in.
const AUTH_PAGE = /^\/(?:en\/)?(?:prijava|registracija|auth\/|zaboravljena-lozinka|resetovanje-lozinke|potvrda-adrese)/

function cancel() {
  if (changingListingId.value) {
    returnToWizard(changingListingId.value)
    return
  }
  const back = window.history.state?.back
  if (back && !AUTH_PAGE.test(back)) {
    router.back()
  } else {
    router.push('/kontrolna-tabla/oglasi')
  }
}

// "Otkaži" on the propose step goes back to the categories, without carrying a
// failed submit's message along.
function leavePropose() {
  error.value = ''
  step.value = 'top'
}

function selectTopCategory(cat) {
  error.value = ''
  if (cat.children?.length) {
    activeTopCategory.value = cat
    step.value = 'sub'
    return
  }
  selectLeafCategory(cat.id)
}

async function selectLeafCategory(categoryId) {
  error.value = ''
  try {
    if (changingListingId.value) {
      await api.patch(`/listings/${changingListingId.value}/category`, { categoryId })
      returnToWizard(changingListingId.value)
      return
    }
    const listing = await api.post('/listings', { categoryId })
    await navigateTo(`/oglasi/${listing.id}/uredi`)
  } catch (e) {
    error.value = extractErrorMessage(e, t('auth.genericError'))
  }
}

async function submitUncategorized() {
  error.value = ''
  submitting.value = true
  try {
    await api.post('/listings/uncategorized', {
      title: uncategorized.title,
      bookingModel: uncategorized.bookingModel,
      priceUnit: uncategorized.bookingModel !== 'NO_BOOKING' ? uncategorized.priceUnit : undefined,
      description: uncategorized.description || undefined,
    })
    // T60 — this used to drop the owner straight into the wizard under
    // "Ostalo", which isn't a real selectable category and let a listing
    // publish/get paid for under it. The listing this creates is parked
    // (pendingCategoryAssignment) for an admin to assign a real category —
    // the owner's part ends here with a confirmation, not the wizard.
    step.value = 'submitted'
  } catch (e) {
    error.value = extractErrorMessage(e, t('auth.genericError'))
  } finally {
    submitting.value = false
  }
}

useSeoMeta({ title: () => t(changingListingId.value ? 'listing.changeCategory' : 'listing.chooseCategory') })
</script>

<style lang="scss" scoped>
// Every value on the category and subcategory steps is read off frame
// 172:287, and every value on the propose step off frame 514:514.

// 172:310 — 44 under the header; 176:287 ends 40 above the footer.
.category-pick {
  padding: 44px 0 40px;
}

// 172:325
.category-pick-hero {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-bottom: 40px;
}

.category-pick-eyebrow {
  font-size: 12px;
  font-weight: 500;
  line-height: normal;
  letter-spacing: 0.7px;
  text-transform: uppercase;
  color: $color-primary;
}

.category-pick-title {
  font-size: 44px;
  font-weight: 400;
  line-height: 50px;
  letter-spacing: -1.54px;
  color: $color-text;
}

.category-pick-subtitle {
  max-width: 720px;
  font-size: 18px;
  line-height: 27px;
  color: $color-text-muted;
}

// 174:287 — 280px cards 32 apart: four to a row at 1216, fewer as the
// container narrows. The frame leaves every card at its own height.
.category-pick-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 32px;
  align-items: start;
}

// 174:304 — Figma's 1px stroke sits inside the 22px padding. The icon follows
// the card's colour: #CED6DE idle, blue together with the border on hover,
// which is the state 174:290 is drawn in.
.category-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 16px;
  width: 100%;
  min-width: 0;
  margin: 0;
  padding: 21px;
  border: 1px solid $color-border;
  border-radius: 16px;
  background: $color-surface;
  color: #ced6de;
  font-family: $font-family-base;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    color 0.15s ease;
}

.category-card:hover,
.category-card:focus-visible {
  border-color: $color-primary;
  color: $color-primary;
}

.category-card:focus-visible {
  outline: 2px solid rgba($color-primary, 0.35);
  outline-offset: 2px;
}

.category-card-icon {
  display: flex;
}

.category-card-text {
  display: flex;
  flex-direction: column;
  gap: 7px;
  width: 100%;
}

.category-card-name {
  font-size: 18px;
  font-weight: 500;
  line-height: normal;
  color: $color-text;
}

// A two-line box in the frame, even where the copy fits on one line.
.category-card-desc {
  min-height: 36px;
  font-size: 13px;
  line-height: 18px;
  color: $color-text-muted;
}

// 174:347 — dashed #C8D3E0, no fill. The stroke is painted over the card, not
// set as a border: Figma's 1.5px inside stroke doesn't move the content (a CSS
// border snaps to 1px at 1x and leaves the card a pixel short), and its dashes
// run about 7 on / 7 off, far longer than a CSS dashed border's. The SVG
// strokes the card's edge 3px wide so exactly the inner 1.5px shows.
$unlock-dash-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='100%25' height='100%25' rx='16' fill='none' stroke='%23000' stroke-width='3' stroke-dasharray='7 7'/%3E%3C/svg%3E");

.category-card-unlock {
  position: relative;
  padding: 22px;
  border: 0;
  background: transparent;
}

.category-card-unlock::before {
  content: '';
  position: absolute;
  inset: 0;
  background-color: #c8d3e0;
  -webkit-mask: $unlock-dash-mask center / 100% 100% no-repeat;
  mask: $unlock-dash-mask center / 100% 100% no-repeat;
  pointer-events: none;
  transition: background-color 0.15s ease;
}

.category-card-unlock:hover::before,
.category-card-unlock:focus-visible::before {
  background-color: $color-primary;
}

// 174:349
.category-card-unlock-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border-radius: 12px;
  background: $color-background;
}

.category-card-unlock-icon img {
  display: block;
  width: 24px;
  height: 24px;
}

// 176:287 — 64 under the grid.
.category-pick-actions {
  display: flex;
  margin-top: 64px;
}

// 176:288
.category-pick-back {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  height: 52px;
  margin: 0;
  padding: 0 26px 0 24px;
  border: 0;
  border-radius: 8px;
  background: $color-background;
  color: $color-text;
  font-family: $font-family-base;
  font-size: 15px;
  font-weight: 500;
  line-height: normal;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.category-pick-back:hover {
  background: $color-border;
}

.category-pick-back:focus-visible {
  outline: 2px solid rgba($color-primary, 0.35);
  outline-offset: 2px;
}

.category-pick-back img {
  display: block;
  width: 16px;
  height: 16px;
}

// Dizajn 6 error state (214:436) — Figma variables, not tokens; the same
// values _auth.scss uses.
$propose-danger-bg: #fcd8e0;
$propose-danger-border: #f43f5e;

// 514:544 — the column starts 48 under the header and ends 88 above the footer.
.category-pick-propose {
  padding: 48px 0 88px;
}

// 514:545
.propose {
  display: flex;
  flex-direction: column;
  gap: 30px;
  max-width: 720px;
  margin: 0 auto;
}

// 651:1051
.propose-head {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.propose-eyebrow {
  font-size: 11px;
  font-weight: 500;
  line-height: normal;
  letter-spacing: 0.66px;
  text-transform: uppercase;
  color: $color-primary;
}

.propose-title {
  margin: 0;
  font-size: 44px;
  font-weight: 600;
  line-height: normal;
  letter-spacing: 0;
  color: $color-text;
}

.propose-subtitle {
  font-size: 16px;
  line-height: 26px;
  color: $color-text-muted;
}

// 651:1055 — Figma's stroke sits inside the 36/40/32 padding, so each side is
// a pixel less here plus the 1px border.
.propose-form {
  display: flex;
  flex-direction: column;
  gap: 26px;
  padding: 35px 39px 31px;
  border: 1px solid $color-border;
  border-radius: 20px;
  background: $color-surface;
}

// 651:1056
.propose-field {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.propose-label {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 14px;
  font-weight: 500;
  line-height: normal;
  color: $color-text;
}

.propose-required {
  color: $color-error;
}

// 651:1093
.propose-optional {
  font-size: 13px;
  font-weight: 300;
  color: $color-text-muted;
}

// 651:1060 — 51 tall, 20 side padding, no stroke. Focus (214:429) and error
// (214:436) draw their 1.5px stroke as an inset shadow so the text never moves.
.propose-input {
  display: block;
  width: 100%;
  height: 51px;
  margin: 0;
  padding: 0 20px;
  border: 0;
  border-radius: $radius-input;
  background-color: $color-background;
  color: $color-text;
  font-family: $font-family-base;
  font-size: 15px;
  line-height: normal;
  transition:
    background-color 0.15s ease,
    box-shadow 0.15s ease;
}

.propose-input::placeholder {
  color: $color-text-muted;
  opacity: 1;
}

.propose-input:focus {
  outline: none;
  background-color: $color-surface;
  box-shadow: inset 0 0 0 1.5px $color-primary;
}

.propose-input.is-invalid {
  background-color: $propose-danger-bg;
  box-shadow: inset 0 0 0 1.5px $propose-danger-border;
}

// 651:1085 — the 14px chevron sits 20 from the right edge, 10 past the value.
.propose-select {
  appearance: none;
  padding-right: 44px;
  background-image: url('/images/icons/chevron-down.svg');
  background-position: right 20px center;
  background-size: 14px 14px;
  background-repeat: no-repeat;
  cursor: pointer;
}

// 651:1094
.propose-textarea {
  height: 110px;
  padding: 16px 20px;
  resize: none;
}

// 651:1089
.propose-hint {
  font-size: 13px;
  font-weight: 300;
  line-height: 19px;
  color: $color-text-muted;
}

// 214:438
.propose-error {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  line-height: normal;
  color: $color-error;
}

.propose-error img {
  flex-shrink: 0;
  width: 15px;
  height: 15px;
}

// 651:1062
.propose-options {
  gap: 12px;
}

// 651:1066 (selected) / 651:1071 — 69 tall. The idle option's stroke sits
// inside its 16/18 padding; the selected one has no stroke, so its border is
// only transparent to keep both the same size.
.propose-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 15px 17px;
  border: 1px solid $color-border;
  border-radius: 12px;
  background: $color-surface;
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease;
}

.propose-option:hover {
  border-color: $color-primary;
}

.propose-option.is-selected {
  border-color: transparent;
  background: $color-accent-tint;
}

// 651:1067 / 651:1072 — the frame's own radio drawings.
.propose-radio {
  appearance: none;
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  margin: 0;
  border: 0;
  border-radius: 50%;
  background: url('/images/icons/radio-off.svg') center / 18px 18px no-repeat;
  cursor: pointer;
}

.propose-radio:checked {
  background-image: url('/images/icons/radio-on.svg');
}

.propose-radio:focus-visible {
  outline: 2px solid rgba($color-primary, 0.35);
  outline-offset: 2px;
}

.propose-option-text {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.propose-option-title {
  font-size: 15px;
  font-weight: 500;
  line-height: normal;
  color: $color-text;
}

.propose-option-hint {
  font-size: 13px;
  font-weight: 300;
  line-height: normal;
  color: $color-text-muted;
}

// 651:1096
.propose-note {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 16px 18px;
  border-radius: 12px;
  background: $color-accent-tint;
}

.propose-note img {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
}

.propose-note p {
  font-size: 13px;
  line-height: 20px;
  color: $color-primary;
}

// 651:1102
.propose-divider {
  height: 1px;
  background: $color-border;
}

// 651:1103
.propose-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.propose-submit,
.propose-cancel {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 51px;
  margin: 0;
  border-radius: $radius-pill;
  font-family: $font-family-base;
  font-size: 15px;
  font-weight: 500;
  line-height: normal;
  white-space: nowrap;
  cursor: pointer;
}

// 651:1104 — left-to-right gradient, 2 stops.
.propose-submit {
  padding: 0 28px;
  border: 0;
  background: linear-gradient(90deg, $color-gradient-start 0%, $color-gradient-mid 100%);
  color: $color-surface;
  transition: opacity 0.15s ease;
}

.propose-submit:hover:not(:disabled) {
  color: $color-surface;
  opacity: 0.92;
}

.propose-submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

// 651:1106 — the stroke sits inside the 28px padding.
.propose-cancel {
  padding: 0 27px;
  border: 1px solid $color-border;
  background: $color-surface;
  color: $color-text;
  transition: border-color 0.15s ease;
}

.propose-cancel:hover {
  border-color: $color-primary;
}

.propose-submit:focus-visible,
.propose-cancel:focus-visible {
  outline: 2px solid rgba($color-primary, 0.35);
  outline-offset: 2px;
}

@include respond-below(md) {
  .category-pick {
    padding: 32px 0 40px;
  }

  .category-pick-title {
    font-size: 34px;
    line-height: 40px;
    letter-spacing: -1.19px;
  }

  .category-pick-subtitle {
    font-size: 16px;
    line-height: 24px;
  }

  .category-pick-grid {
    gap: 16px;
  }

  .category-pick-actions {
    margin-top: 40px;
  }

  .category-pick-propose {
    padding: 32px 0 56px;
  }

  .propose-title {
    font-size: 34px;
  }

  .propose-form {
    padding: 23px 19px;
  }
}

@include respond-below(sm) {
  .category-pick-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .propose-actions {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
