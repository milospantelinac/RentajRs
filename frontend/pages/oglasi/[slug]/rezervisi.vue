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

            <template v-else>
              <div class="row">
                <div class="col-6">
                  <div class="form-group mb-3">
                    <label class="form-label">{{ startLabel }}</label>
                    <input v-model="form.startsAt" :type="dateInputType" class="form-control" />
                  </div>
                </div>
                <div class="col-6">
                  <div class="form-group mb-3">
                    <label class="form-label">{{ endLabel }}</label>
                    <input v-model="form.endsAt" :type="dateInputType" class="form-control" />
                  </div>
                </div>
              </div>
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

const slots = ref([])
const form = reactive({
  startsAt: '',
  endsAt: '',
  definedSlotId: null,
  guestCount: 1,
  guestMessage: '',
  extraServices: [],
})
const error = ref('')
const submitting = ref(false)

const dateInputType = computed(() =>
  listing.value?.bookingModel === 'PER_STAY' ? 'date' : 'datetime-local',
)

const startLabel = computed(() => {
  if (listing.value?.category?.slug === 'nekretnine') return t('booking.checkIn')
  if (['vozila', 'masine', 'oprema'].includes(listing.value?.category?.slug)) return t('booking.pickup')
  return t('booking.dateTime')
})
const endLabel = computed(() => {
  if (listing.value?.category?.slug === 'nekretnine') return t('booking.checkOut')
  if (['vozila', 'masine', 'oprema'].includes(listing.value?.category?.slug)) return t('booking.dropoff')
  return t('booking.dateTimeEnd')
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
    } else {
      payload.startsAt = new Date(form.startsAt).toISOString()
      payload.endsAt = new Date(form.endsAt).toISOString()
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
