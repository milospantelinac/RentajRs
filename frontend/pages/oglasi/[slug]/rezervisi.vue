<template>
  <div v-if="listing" class="container booking-page py-4">
    <div class="row justify-content-center">
      <div class="col-12 col-md-7">
        <h1 class="text-page-title mb-1">{{ listing.title }}</h1>
        <p class="text-muted mb-4">{{ t('listing.sendRequest') }}</p>

        <p v-if="isOwnListing" class="text-muted">{{ t('booking.ownListingNotice') }}</p>

        <div v-else class="card">
          <div class="card-body">
            <BookingRulesSummary :listing="listing" class="mb-3" />

            <template v-if="listing.bookingModel === 'PER_SLOT' && listing.slotSubmode === 'DEFINED_SLOTS'">
              <div class="form-group mb-3">
                <label class="form-label">{{ t('booking.chooseSlot') }}</label>
                <div v-if="slots.length" class="slot-list">
                  <button
                    v-for="slot in slots"
                    :key="slot.id"
                    class="btn btn-tertiary btn-sm slot-btn"
                    :class="{ 'slot-btn-active': form.definedSlotId === slot.id }"
                    @click="selectSlot(slot)"
                  >
                    <span>{{ formatDateTime(slot.startsAt) }} — {{ formatDateTime(slot.endsAt) }}</span>
                    <span class="slot-btn-price">{{ formatPrice(slot.price ?? listing.price) }}</span>
                  </button>
                </div>
                <p v-else class="text-muted">{{ t('booking.noSlots') }}</p>
              </div>
            </template>

            <template v-else-if="listing.priceUnit === 'MONTH'">
              <div class="form-group mb-3">
                <label class="form-label">{{ t('booking.monthPicker') }}</label>
                <BookingMonthPicker
                  :listing-id="listing.id"
                  :base-price="listing.price"
                  :min-duration="listing.minDuration"
                  :max-duration="listing.maxDuration"
                  @update:range="onMonthRangeUpdate"
                />
              </div>
            </template>

            <template v-else-if="listing.bookingModel === 'PER_STAY'">
              <div class="form-group mb-3">
                <label class="form-label">{{ t('booking.rangePickerLabel') }}</label>
                <BookingDateRangePicker
                  :listing-id="listing.id"
                  :base-price="listing.price"
                  :weekend-price="listing.weekendPrice"
                  :show-pricing="true"
                  :price-unit="listing.priceUnit"
                  :min-duration="listing.minDuration"
                  :max-duration="listing.maxDuration"
                  :earliest-booking-hours="listing.earliestBookingHours"
                  :max-advance-booking-days="listing.maxAdvanceBookingDays"
                  @update:range="onRangeUpdate"
                />
              </div>
            </template>

            <!-- PER_SLOT + WORKING_HOURS — pick a free date, then a start
                 time constrained to that day's configured working hours,
                 same "see real availability, don't guess" goal as the
                 range picker above. -->
            <template v-else>
              <div class="form-group mb-3">
                <label class="form-label">{{ t('booking.pickDate') }}</label>
                <BookingDateRangePicker
                  :listing-id="listing.id"
                  :show-pricing="false"
                  :earliest-booking-hours="listing.earliestBookingHours"
                  :max-advance-booking-days="listing.maxAdvanceBookingDays"
                  :available-days-of-week="availableDaysOfWeek"
                  :whole-day-blocking="false"
                  @update:range="onSingleDateUpdate"
                />
              </div>
              <div v-if="form.startsAt" class="row">
                <div class="col-6">
                  <div class="form-group mb-3">
                    <label class="form-label">{{ t('booking.startTime') }}</label>
                    <select v-model="slotStartTime" class="form-control form-select" @change="error = ''">
                      <option v-for="time in dayTimeOptions" :key="time" :value="time">{{ time }}</option>
                    </select>
                  </div>
                </div>
                <div class="col-6">
                  <div class="form-group mb-3">
                    <label class="form-label">{{ t('booking.durationHours') }}</label>
                    <input v-model.number="slotDurationHours" type="number" min="1" max="12" class="form-control" @input="error = ''" />
                  </div>
                </div>
              </div>
              <p v-if="form.startsAt && !dayTimeOptions.length" class="text-muted">{{ t('booking.noWorkingHoursForDay') }}</p>
            </template>

            <div class="form-group mb-3">
              <label class="form-label">{{ t('booking.guestCount') }}</label>
              <input
                v-model.number="form.guestCount"
                type="number"
                min="1"
                :max="effectiveMaxGuests || undefined"
                class="form-control"
                @input="error = ''"
              />
              <p v-if="effectiveMaxGuests && form.guestCount > effectiveMaxGuests" class="form-error mb-0 mt-1">
                {{ t('booking.guestCountExceeds', { max: effectiveMaxGuests }) }}
              </p>
            </div>

            <!-- T76 — a "Oba" listing accepts either method but never actually
                 asked the guest which one; without this the approval step had
                 no real choice to branch on and silently treated every such
                 booking as online. -->
            <div v-if="listing.paymentMethod === 'BOTH'" class="form-group mb-3">
              <label class="form-label">{{ t('booking.paymentMethodLabel') }}</label>
              <select v-model="form.paymentMethod" class="form-control form-select" @change="error = ''">
                <option value="" disabled>{{ t('booking.paymentMethodChoose') }}</option>
                <option value="CASH">{{ t('booking.paymentMethodCash') }}</option>
                <option value="BANK_TRANSFER">{{ t('booking.paymentMethodOnline') }}</option>
              </select>
            </div>

            <div v-if="listing.extraServices?.length" class="mb-3">
              <p class="text-label mb-2">{{ t('listing.extraServices') }}</p>
              <label v-for="service in listing.extraServices" :key="service.id" class="form-row-inline mb-2">
                <input type="checkbox" class="form-checkbox" @change="toggleService(service, $event.target.checked)" />
                {{ service.name }} (+{{ formatPrice(service.price) }})
              </label>
            </div>

            <div class="form-group mb-4">
              <label class="form-label">{{ t('booking.message') }}</label>
              <textarea v-model="form.guestMessage" class="form-control" rows="3" />
            </div>

            <div v-if="quote" class="price-summary mb-3">
              <div class="row mb-1">
                <div class="col-8 text-muted">
                  {{ quote.unitCount }} {{ srDurationUnitWord(listing.priceUnit, quote.unitCount) }}
                  <span v-if="listing.weekendPrice" class="price-summary-hint">({{ t('booking.weekendPriceIncluded') }})</span>
                </div>
                <div class="col-4 text-end">{{ formatPrice(quote.unitPriceTotal) }}</div>
              </div>
              <div v-if="quote.guestFee > 0" class="row mb-1">
                <div class="col-8 text-muted">{{ t('booking.guestFeeLine') }}</div>
                <div class="col-4 text-end">{{ formatPrice(quote.guestFee) }}</div>
              </div>
              <div v-if="quote.mandatoryFeesTotal > 0" class="row mb-1">
                <div class="col-8 text-muted">{{ t('booking.mandatoryFeesLine') }}</div>
                <div class="col-4 text-end">{{ formatPrice(quote.mandatoryFeesTotal) }}</div>
              </div>
              <div v-if="quote.extraServicesTotal > 0" class="row mb-1">
                <div class="col-8 text-muted">{{ t('listing.extraServices') }}</div>
                <div class="col-4 text-end">{{ formatPrice(quote.extraServicesTotal) }}</div>
              </div>
              <div class="row price-summary-total mt-2 pt-2">
                <div class="col-8"><strong>{{ t('booking.totalAmount') }}</strong></div>
                <div class="col-4 text-end"><strong>{{ formatPrice(quote.totalAmount) }}</strong></div>
              </div>
              <div v-if="quote.amountDue !== quote.totalAmount" class="row">
                <div class="col-8 text-muted">{{ t('booking.payAmount') }}</div>
                <div class="col-4 text-end">{{ formatPrice(quote.amountDue) }}</div>
              </div>
            </div>

            <p v-if="error" class="form-error mb-3">{{ error }}</p>

            <button
              class="btn btn-primary-flat btn-block"
              :disabled="submitting || (effectiveMaxGuests && form.guestCount > effectiveMaxGuests)"
              @click="submit"
            >
              {{ submitting ? t('common.loading') : t('listing.sendRequest') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
definePageMeta({ middleware: 'auth' })
const { t } = useI18n()
const api = useApi()
const route = useRoute()
const auth = useAuthStore()

const { data: listing } = await useAsyncData(`booking-listing-${route.params.slug}`, () =>
  api.get(`/listings/public/${route.params.slug}`),
)

if (listing.value && (listing.value.bookingModel === 'NO_BOOKING' || !listing.value.canBook)) {
  await navigateTo(`/oglasi/${listing.value.slug}`)
}

// T86 — the server already refuses this (errors.CANNOT_BOOK_OWN_LISTING),
// but the form let an owner fill the whole thing in first and only found out
// on submit; gate it up front instead.
const isOwnListing = computed(() => !!listing.value && auth.user?.id === listing.value.userId)

// Mirrors the backend's dual-source cap (bookings.service.ts createRequest):
// "Kapacitet ljudi" is a per-category attribute set in the wizard, separate
// from the generic minGuests/maxGuests pair — prefer it when present since
// it's the number actually shown to guests as the listing's capacity.
const effectiveMaxGuests = computed(() => {
  const attr = listing.value?.attributes?.find((a) => a.key === 'kapacitet_ljudi')
  const attrValue = attr?.value?.valueNumber
  if (attrValue != null) return Number(attrValue)
  return listing.value?.maxGuests ?? null
})

const slots = ref([])
const form = reactive({
  startsAt: '',
  endsAt: '',
  monthStart: '',
  monthCount: 1,
  definedSlotId: null,
  guestCount: 1,
  guestMessage: '',
  extraServices: [],
  paymentMethod: '',
})
const error = ref('')
const submitting = ref(false)

// PER_SLOT + WORKING_HOURS — a picked date's day-of-week gates which start
// times are actually offered, straight from the owner's configured hours,
// so a guest can't submit a time that was never open to begin with.
const workingHours = ref([])
const slotStartTime = ref('')
const slotDurationHours = ref(1)
// T74 — already-booked/blocked terms for this listing, used to keep the
// calendar and "Vreme početka" list from offering what the server would
// reject anyway (BlockedTerm rows carry exact start/end instants, not whole
// days, so a single booked hour doesn't need to hide the rest of the day).
const blocked = ref([])

// T74 — null while workingHours hasn't loaded yet (no restriction rather than
// a false "every day is closed" flash); once loaded, only the configured
// days of the week stay clickable in the calendar.
const availableDaysOfWeek = computed(() =>
  workingHours.value.length ? [...new Set(workingHours.value.map((h) => h.dayOfWeek))] : null,
)

function overlapsBlocked(startsAt, endsAt) {
  const start = new Date(startsAt).getTime()
  const end = new Date(endsAt).getTime()
  return blocked.value.some((b) => new Date(b.startsAt).getTime() < end && new Date(b.endsAt).getTime() > start)
}

// T86 — a stale server-rejection message used to sit above the button
// forever, even after the guest fixed the very thing it complained about
// (and even once a since-corrected request had already gone through); every
// selection change clears it instead of waiting for the next submit attempt.
function onRangeUpdate({ startsAt, endsAt }) {
  form.startsAt = startsAt || ''
  form.endsAt = endsAt || ''
  error.value = ''
}
function onMonthRangeUpdate({ monthStart, monthCount }) {
  form.monthStart = monthStart || ''
  form.monthCount = monthCount || 1
  error.value = ''
}
function onSingleDateUpdate({ startsAt }) {
  form.startsAt = startsAt || ''
  slotStartTime.value = ''
  error.value = ''
}
function selectSlot(slot) {
  form.definedSlotId = slot.id
  error.value = ''
}

const dayTimeOptions = computed(() => {
  if (!form.startsAt) return []
  const dayOfWeek = ((new Date(`${form.startsAt}T00:00:00`).getDay() + 6) % 7) + 1 // ISO Monday=1
  const ranges = workingHours.value.filter((h) => h.dayOfWeek === dayOfWeek)
  const times = []
  for (const range of ranges) {
    let [h, m] = range.startsAt.split(':').map(Number)
    const [endH, endM] = range.endsAt.split(':').map(Number)
    while (h < endH || (h === endH && m < endM)) {
      times.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
      m += 60
      if (m >= 60) { m -= 60; h += 1 }
    }
  }
  // T74 — an already-booked/pending slot must not appear in the list at all,
  // not just get rejected on submit; check against the currently-chosen
  // duration since that's what would actually be reserved.
  return times.filter((time) => {
    const startsAt = new Date(`${form.startsAt}T${time}:00`)
    const endsAt = new Date(startsAt.getTime() + slotDurationHours.value * 3600_000)
    return !overlapsBlocked(startsAt, endsAt)
  })
})
// T74 — a duration change (or the list itself refreshing) can invalidate an
// already-picked start time; don't leave a now-unavailable time selected.
watch(dayTimeOptions, (times) => {
  if (slotStartTime.value && !times.includes(slotStartTime.value)) slotStartTime.value = ''
})

function toggleService(service, checked) {
  if (checked) {
    form.extraServices.push({ serviceId: service.id, quantity: 1 })
  } else {
    form.extraServices = form.extraServices.filter((s) => s.serviceId !== service.id)
  }
  error.value = ''
}

function formatDateTime(value) {
  return new Date(value).toLocaleString('sr-RS')
}

function formatPrice(value) {
  return `${new Intl.NumberFormat('sr-RS').format(value || 0)} RSD`
}

// T83 — the exact shape /bookings and /bookings/quote both expect; shared so
// the live price preview can never compute against a different selection
// than what submit() actually sends.
function buildBookingPayload() {
  // T76 — only meaningful (and only required) when the listing itself
  // accepts both methods; sending it for a single-method listing is
  // harmless since the backend ignores it there.
  if (listing.value.paymentMethod === 'BOTH' && !form.paymentMethod) return null
  const base = {
    guestCount: form.guestCount,
    extraServices: form.extraServices.length ? form.extraServices : undefined,
    paymentMethod: listing.value.paymentMethod === 'BOTH' ? form.paymentMethod : undefined,
  }
  if (form.definedSlotId) {
    return { ...base, definedSlotId: form.definedSlotId }
  }
  if (listing.value.priceUnit === 'MONTH') {
    if (!form.monthStart) return null
    return { ...base, monthStart: form.monthStart, monthCount: form.monthCount }
  }
  if (listing.value.bookingModel === 'PER_SLOT' && listing.value.slotSubmode === 'WORKING_HOURS') {
    if (!form.startsAt || !slotStartTime.value) return null
    const startsAt = new Date(`${form.startsAt}T${slotStartTime.value}:00`)
    const endsAt = new Date(startsAt.getTime() + slotDurationHours.value * 3600_000)
    return { ...base, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() }
  }
  if (!form.startsAt || !form.endsAt) return null
  // PER_STAY range picker gives plain YYYY-MM-DD; a bare date parses as UTC
  // midnight, matching how the calendar/backend already key nights.
  return {
    ...base,
    startsAt: new Date(`${form.startsAt}T00:00:00.000Z`).toISOString(),
    endsAt: new Date(`${form.endsAt}T00:00:00.000Z`).toISOString(),
  }
}

const quote = ref(null)
async function refreshQuote() {
  const payload = buildBookingPayload()
  if (!payload) {
    quote.value = null
    return
  }
  try {
    quote.value = await api.post(`/listings/${listing.value.id}/bookings/quote`, payload)
  } catch {
    quote.value = null
  }
}
watch(
  () => [
    form.startsAt,
    form.endsAt,
    form.monthStart,
    form.monthCount,
    form.definedSlotId,
    form.guestCount,
    form.extraServices.length,
    form.paymentMethod,
    slotStartTime.value,
    slotDurationHours.value,
  ],
  refreshQuote,
)

async function submit() {
  error.value = ''
  const payload = buildBookingPayload()
  if (!payload) return
  submitting.value = true
  try {
    payload.guestMessage = form.guestMessage || undefined
    const booking = await api.post(`/listings/${listing.value.id}/bookings`, payload)
    await navigateTo(`/rezervacije/${booking.id}`)
  } catch (e) {
    error.value = extractErrorMessage(e, t('auth.genericError'))
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  if (listing.value?.bookingModel === 'PER_SLOT' && listing.value?.slotSubmode === 'DEFINED_SLOTS') {
    const availability = await api.get(`/listings/${listing.value.id}/availability`)
    const blockedTerms = availability.blocked || []
    // T74 — a defined slot with a pending or confirmed booking on it must
    // not be offered again; the server already refuses the double-booking,
    // this just stops the guest from picking it in the first place.
    slots.value = (availability.definedSlots || []).filter(
      (s) => !blockedTerms.some((b) => new Date(b.startsAt).getTime() < new Date(s.endsAt).getTime() && new Date(b.endsAt).getTime() > new Date(s.startsAt).getTime()),
    )
  } else if (listing.value?.bookingModel === 'PER_SLOT' && listing.value?.slotSubmode === 'WORKING_HOURS') {
    const availability = await api.get(`/listings/${listing.value.id}/availability`)
    workingHours.value = availability.workingHours || []
    blocked.value = availability.blocked || []
  }
})

useSeoMeta({ title: () => `${t('listing.sendRequest')} — ${listing.value?.title}` })
</script>

<style lang="scss" scoped>
.booking-page {
  padding: 32px 0 64px;
}

.slot-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.slot-btn {
  justify-content: space-between;
}

.slot-btn-active {
  border-color: $color-primary;
  color: $color-primary;
}

.slot-btn-price {
  color: $color-text-muted;
  font-size: $font-size-label;
}

.price-summary {
  padding: 12px 14px;
  border: 1px solid $color-border;
  border-radius: $radius-input;
  font-size: $font-size-body;
}

.price-summary-total {
  border-top: 1px solid $color-border;
}

.price-summary-hint {
  font-size: $font-size-label;
}
</style>
