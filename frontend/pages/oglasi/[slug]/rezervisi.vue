<template>
  <div v-if="listing" class="container booking-page py-4">
    <div class="row justify-content-center">
      <div class="col-12 col-md-7">
        <h1 class="text-page-title mb-1">{{ listing.title }}</h1>
        <p class="text-muted mb-4">{{ t('listing.sendRequest') }}</p>

        <div class="card">
          <div class="card-body">
            <template v-if="listing.bookingModel === 'PER_SLOT' && listing.slotSubmode === 'DEFINED_SLOTS'">
              <div class="form-group mb-3">
                <label class="form-label">{{ t('booking.chooseSlot') }}</label>
                <div v-if="slots.length" class="slot-list">
                  <button
                    v-for="slot in slots"
                    :key="slot.id"
                    class="btn btn-tertiary btn-sm slot-btn"
                    :class="{ 'slot-btn-active': form.definedSlotId === slot.id }"
                    @click="form.definedSlotId = slot.id"
                  >
                    {{ formatDateTime(slot.startsAt) }} — {{ formatDateTime(slot.endsAt) }}
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
                  @update:range="onSingleDateUpdate"
                />
              </div>
              <div v-if="form.startsAt" class="row">
                <div class="col-6">
                  <div class="form-group mb-3">
                    <label class="form-label">{{ t('booking.startTime') }}</label>
                    <select v-model="slotStartTime" class="form-control form-select">
                      <option v-for="time in dayTimeOptions" :key="time" :value="time">{{ time }}</option>
                    </select>
                  </div>
                </div>
                <div class="col-6">
                  <div class="form-group mb-3">
                    <label class="form-label">{{ t('booking.durationHours') }}</label>
                    <input v-model.number="slotDurationHours" type="number" min="1" max="12" class="form-control" />
                  </div>
                </div>
              </div>
              <p v-if="form.startsAt && !dayTimeOptions.length" class="text-muted">{{ t('booking.noWorkingHoursForDay') }}</p>
            </template>

            <div class="form-group mb-3">
              <label class="form-label">{{ t('booking.guestCount') }}</label>
              <input v-model.number="form.guestCount" type="number" min="1" class="form-control" />
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

            <p v-if="error" class="form-error mb-3">{{ error }}</p>

            <button class="btn btn-primary-flat btn-block" :disabled="submitting" @click="submit">
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

const { data: listing } = await useAsyncData(`booking-listing-${route.params.slug}`, () =>
  api.get(`/listings/public/${route.params.slug}`),
)

if (listing.value && (listing.value.bookingModel === 'NO_BOOKING' || !listing.value.canBook)) {
  await navigateTo(`/oglasi/${listing.value.slug}`)
}

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
})
const error = ref('')
const submitting = ref(false)

// PER_SLOT + WORKING_HOURS — a picked date's day-of-week gates which start
// times are actually offered, straight from the owner's configured hours,
// so a guest can't submit a time that was never open to begin with.
const workingHours = ref([])
const slotStartTime = ref('')
const slotDurationHours = ref(1)

function onRangeUpdate({ startsAt, endsAt }) {
  form.startsAt = startsAt || ''
  form.endsAt = endsAt || ''
}
function onMonthRangeUpdate({ monthStart, monthCount }) {
  form.monthStart = monthStart || ''
  form.monthCount = monthCount || 1
}
function onSingleDateUpdate({ startsAt }) {
  form.startsAt = startsAt || ''
  slotStartTime.value = ''
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
  return times
})

function toggleService(service, checked) {
  if (checked) {
    form.extraServices.push({ serviceId: service.id, quantity: 1 })
  } else {
    form.extraServices = form.extraServices.filter((s) => s.serviceId !== service.id)
  }
}

function formatDateTime(value) {
  return new Date(value).toLocaleString('sr-RS')
}

function formatPrice(value) {
  return `${new Intl.NumberFormat('sr-RS').format(value || 0)} RSD`
}

async function submit() {
  error.value = ''
  submitting.value = true
  try {
    const payload = {
      guestCount: form.guestCount,
      guestMessage: form.guestMessage || undefined,
      extraServices: form.extraServices.length ? form.extraServices : undefined,
    }
    if (form.definedSlotId) {
      payload.definedSlotId = form.definedSlotId
    } else if (listing.value.priceUnit === 'MONTH') {
      payload.monthStart = form.monthStart
      payload.monthCount = form.monthCount
    } else if (listing.value.bookingModel === 'PER_SLOT' && listing.value.slotSubmode === 'WORKING_HOURS') {
      const startsAt = new Date(`${form.startsAt}T${slotStartTime.value}:00`)
      const endsAt = new Date(startsAt.getTime() + slotDurationHours.value * 3600_000)
      payload.startsAt = startsAt.toISOString()
      payload.endsAt = endsAt.toISOString()
    } else {
      // PER_STAY range picker gives plain YYYY-MM-DD; a bare date parses as
      // UTC midnight, matching how the calendar/backend already key nights.
      payload.startsAt = new Date(`${form.startsAt}T00:00:00.000Z`).toISOString()
      payload.endsAt = new Date(`${form.endsAt}T00:00:00.000Z`).toISOString()
    }
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
    slots.value = availability.definedSlots || []
  } else if (listing.value?.bookingModel === 'PER_SLOT' && listing.value?.slotSubmode === 'WORKING_HOURS') {
    const availability = await api.get(`/listings/${listing.value.id}/availability`)
    workingHours.value = availability.workingHours || []
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
  justify-content: flex-start;
}

.slot-btn-active {
  border-color: $color-primary;
  color: $color-primary;
}
</style>
