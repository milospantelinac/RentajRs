<template>
  <!-- 538:557: a day, then one of its defined slots. -->
  <section v-if="term.model === 'slots'" class="request-term">
    <RequestSlotPicker v-model="term.form.definedSlotId" :entries="term.slotEntries" />
    <p v-if="error" class="request-error" role="alert">
      <img src="/images/icons/field-error.svg" alt="" />{{ error }}
    </p>
  </section>

  <!-- No frame: a monthly stay, from the frame's own fields. -->
  <section v-else-if="term.model === 'months'" class="request-term">
    <BookingMonthPicker
      variant="request"
      :listing-id="listing.id"
      :availability-path="availabilityPath"
      :base-price="listing.price"
      :min-duration="listing.minDuration"
      :max-duration="listing.maxDuration"
      :earliest-booking-hours="listing.earliestBookingHours"
      :initial-month="term.form.monthStart"
      :initial-count="term.form.monthCount"
      @update:range="term.onMonthRangeUpdate"
      @select="term.onMonthSelect"
    />
    <p v-if="error" class="request-error" role="alert">
      <img src="/images/icons/field-error.svg" alt="" />{{ error }}
    </p>
  </section>

  <!-- 373:406: the calendar and the chosen dates. Working hours (no
       frame) pick one day there, then the start time and length. -->
  <section v-else class="request-term">
    <p class="request-label">{{ t('bookingForm.pickDate') }}</p>
    <BookingDateRangePicker
      v-if="term.model === 'stay'"
      ref="calendar"
      variant="request"
      :listing-id="listing.id"
      :availability-path="availabilityPath"
      :initial-start="term.handedStart"
      :initial-end="term.handedEnd"
      :show-pricing="false"
      :pickup-return="term.pickupReturn"
      :price-unit="listing.priceUnit"
      :min-duration="listing.minDuration"
      :max-duration="listing.maxDuration"
      :earliest-booking-hours="listing.earliestBookingHours"
      :max-advance-booking-days="listing.maxAdvanceBookingDays"
      @update:range="term.onRangeUpdate"
      @select="term.stayPick = $event"
    />
    <BookingDateRangePicker
      v-else
      ref="calendar"
      variant="request"
      :listing-id="listing.id"
      :availability-path="availabilityPath"
      :initial-start="term.handedStart"
      :show-pricing="false"
      :earliest-booking-hours="listing.earliestBookingHours"
      :max-advance-booking-days="listing.maxAdvanceBookingDays"
      :available-days-of-week="term.availableDaysOfWeek"
      :is-day-open="term.isHourDayOpen"
      :whole-day-blocking="false"
      :single-date="true"
      @update:range="term.onSingleDateUpdate"
    />

    <div v-if="term.model === 'hours' && term.form.startsAt" class="request-row">
      <div class="request-field">
        <label class="request-label" for="request-start-time">{{ t('booking.startTime') }}</label>
        <span class="request-select" :class="{ 'is-empty': !term.slotStartTime }">
          <select
            id="request-start-time"
            v-model="term.slotStartTime"
            class="request-select-control"
            :disabled="!term.hourStarts.length"
          >
            <option value="" disabled>{{ t('bookingForm.startTimePlaceholder') }}</option>
            <option v-for="time in term.hourStarts" :key="time" :value="time">{{ time }}</option>
          </select>
          <img src="/images/icons/chevron-down-18.svg" alt="" />
        </span>
      </div>
      <div class="request-field">
        <label class="request-label" for="request-duration">{{ t('bookingForm.duration') }}</label>
        <span class="request-select">
          <select
            id="request-duration"
            v-model.number="term.slotDurationHours"
            class="request-select-control"
            :disabled="!term.durationSelectOptions.length"
          >
            <option v-if="!term.durationSelectOptions.length" :value="term.slotDurationHours" disabled>-</option>
            <option v-for="option in term.durationSelectOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
          <img src="/images/icons/chevron-down-18.svg" alt="" />
        </span>
        <p v-if="term.slotStartTime" class="request-hint">{{ term.closingHint }}</p>
      </div>
    </div>
    <!-- T127: a day without a free term (a link can still carry one). -->
    <p v-if="term.dayWithoutTerms" class="request-alert" role="alert">
      <img src="/images/icons/field-error.svg" alt="" />{{ t('booking.noWorkingHoursForDay') }}
    </p>

    <div v-if="term.termBox" class="request-term-box">
      <div class="request-term-box-text">
        <p class="request-term-box-title">{{ term.termBox.title }}</p>
        <p class="request-term-box-detail">{{ term.termBox.detail }}</p>
      </div>
      <button type="button" class="request-term-box-change" @click="changeTerm">{{ t('bookingForm.change') }}</button>
    </div>
    <p v-if="term.stayTooShort" class="request-error" role="alert">
      <img src="/images/icons/field-error.svg" alt="" />{{ term.minDurationMessage }}
    </p>
    <p v-if="error" class="request-error" role="alert">
      <img src="/images/icons/field-error.svg" alt="" />{{ error }}
    </p>
  </section>
</template>

<script setup>
// The term fields of the request page (Dizajn 40), and of the booking change
// screen (T136), over the state of composables/useRequestTerm.js.
// availabilityPath lets the change screen's calendars read the listing's
// terms with the guest's own booking left free.
const props = defineProps({
  term: { type: Object, required: true },
  listing: { type: Object, required: true },
  error: { type: String, default: '' },
  availabilityPath: { type: String, default: '' },
})
const { t } = useI18n()

const calendar = ref(null)

// 373:608: "Promeni" starts the choice over, from the first free day.
async function changeTerm() {
  calendar.value?.clear()
  props.term.clearStartTime()
  await nextTick()
  calendar.value?.$el?.querySelector('button.range-picker-cell:not(:disabled)')?.focus()
}
</script>

<style lang="scss" scoped>
@use '@/assets/scss/request-form';
</style>
