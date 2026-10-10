// The term a guest picks for a listing: a defined slot, a run of months, a
// stay's dates, or a day with a start time and a length on working hours.
// Moved out of the request page (Dizajn 40, T127) as it was, so that the
// booking change screen (T136) picks a new term by the same rules; the
// fields themselves are components/bookings/RequestTermFields.vue.
//
// listing, availability and now are refs; initial holds what a link handed
// over (startsAt, endsAt, monthStart, monthCount, definedSlotId, startTime,
// hours), each checked before it is used.
export function useRequestTerm({ listing, availability, now, initial = {} }) {
  const { t } = useI18n()

  const model = computed(() => getRequestModel(listing.value))
  // T117: a vehicle or a machine is picked up and returned.
  const pickupReturn = computed(() => usesPickupAndReturn(listing.value))

  const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/
  const text = (value) => (typeof value === 'string' ? value : '')

  // Dizajn 11: the listing page's booking card hands its selection over in the
  // query string; the guest should not have to pick the same term twice.
  const handedStart = DAY_KEY.test(text(initial.startsAt)) ? initial.startsAt : ''
  let handedEnd = DAY_KEY.test(text(initial.endsAt)) ? initial.endsAt : ''
  if (handedEnd && (!handedStart || handedEnd <= handedStart)) handedEnd = ''
  // The calendar holds back a stay shorter than the minimum (T86); the page
  // starts from that answer too, so the server render and the browser agree.
  const handedNights = handedStart && handedEnd ? daysBetweenKeys(handedStart, handedEnd) : 0
  const handedTooShort =
    model.value === 'stay' && !!listing.value?.minDuration && handedNights > 0 && handedNights < listing.value.minDuration

  const form = reactive({
    startsAt: handedStart,
    endsAt: handedTooShort ? '' : handedEnd,
    monthStart: /^\d{4}-\d{2}$/.test(text(initial.monthStart)) ? initial.monthStart : '',
    monthCount: Number(initial.monthCount) || 1,
    definedSlotId: text(initial.definedSlotId) || null,
  })

  // The dates as picked, a stay still too short included (the calendar holds
  // those back from update:range).
  const stayPick = ref(handedStart ? { startsAt: handedStart, endsAt: handedEnd || null, tooShort: handedTooShort } : null)
  const stayTooShort = computed(() => model.value === 'stay' && !!stayPick.value?.tooShort)
  // A monthly stay that runs into a taken month, or no free month at all (T118);
  // the month picker says so itself.
  const monthBlocked = ref(false)
  const noMonthFree = ref(false)
  function onMonthSelect({ blocked, noneFree }) {
    monthBlocked.value = blocked
    noMonthFree.value = noneFree
  }
  const minDurationMessage = computed(() =>
    t('booking.minDurationMessage', {
      min: listing.value.minDuration,
      unit: srDurationUnitWord(listing.value.priceUnit, listing.value.minDuration),
    }),
  )

  function onRangeUpdate({ startsAt, endsAt }) {
    form.startsAt = startsAt || ''
    form.endsAt = endsAt || ''
  }
  function onMonthRangeUpdate({ monthStart, monthCount }) {
    form.monthStart = monthStart || ''
    form.monthCount = monthCount || 1
  }
  // Dizajn 23: the calendar reports the date the booking card handed over as soon as
  // it mounts, so only a different date clears the start time picked with it.
  function onSingleDateUpdate({ startsAt }) {
    if ((startsAt || '') !== form.startsAt) slotStartTime.value = ''
    form.startsAt = startsAt || ''
  }

  // PER_SLOT + WORKING_HOURS: a picked date's day of the week gates which start
  // times are offered, straight from the owner's configured hours (T74).
  const workingHours = computed(() => availability.value?.workingHours || [])
  const availableDaysOfWeek = computed(() =>
    workingHours.value.length ? [...new Set(workingHours.value.map((h) => h.dayOfWeek))] : null,
  )
  const slotStartTime = ref(/^\d{2}:\d{2}$/.test(text(initial.startTime)) ? initial.startTime : '')
  // Dizajn 23: whole hours from the listing's minimum, starting from the length
  // the listing page's booking card priced.
  const slotDurationHours = ref(Number(initial.hours) || listing.value?.minDuration || 1)

  // T127: starts on the hour where the shortest term fits before closing (T74:
  // and runs into nothing taken; Dizajn 23: inside the notice and the horizon),
  // lengths up to closing or the next taken term (Tamara, 2026-10-09).
  const hourStarts = computed(() =>
    model.value === 'hours' && listing.value ? getHourStarts(listing.value, availability.value, form.startsAt, now.value) : [],
  )
  const hourLengths = computed(() =>
    model.value === 'hours' && listing.value
      ? getHourLengths(listing.value, availability.value, form.startsAt, slotStartTime.value, now.value)
      : [],
  )
  // T127 (Tamara, 2026-10-10): the calendar offers only the days a term can still
  // be booked on; one handed over in the link without a free term keeps its
  // fields shut, says why and sends nothing.
  const isHourDayOpen = computed(() =>
    model.value === 'hours' && listing.value && availability.value
      ? makeHourDayCheck(listing.value, availability.value, now.value)
      : null,
  )
  const dayWithoutTerms = computed(() => model.value === 'hours' && !!form.startsAt && !hourStarts.value.length)
  // T118: nor anything on a monthly listing with no month free.
  const termUnavailable = computed(() => dayWithoutTerms.value || (model.value === 'months' && noMonthFree.value))
  const durationSelectOptions = computed(() =>
    hourLengths.value.map((hours) => ({ value: hours, label: formatUnits(t, {}, 'HOUR', hours) })),
  )
  // A time handed over from the listing page may not be free (any more).
  watch(
    hourStarts,
    (times) => {
      if (slotStartTime.value && !times.includes(slotStartTime.value)) slotStartTime.value = ''
    },
    { immediate: true },
  )
  // A later start can't hold as long a term: the length steps down with it.
  watch(
    hourLengths,
    (lengths) => {
      slotDurationHours.value = keepHourLength(lengths, slotDurationHours.value)
    },
    { immediate: true },
  )
  // "Termin može da traje najduže do 20:00."
  const closingHint = computed(() => {
    const longest = hourLengths.value[hourLengths.value.length - 1]
    return slotStartTime.value && longest
      ? t('bookingForm.latestEnd', { time: formatHoursRange(slotStartTime.value, longest).split(' - ')[1] })
      : ''
  })

  const hoursRange = computed(() => {
    if (model.value !== 'hours' || !form.startsAt || !slotStartTime.value) return null
    const startsAt = belgradeInstant(form.startsAt, slotStartTime.value)
    return { startsAt, endsAt: new Date(startsAt.getTime() + slotDurationHours.value * 3_600_000) }
  })

  // 538:874: the slots a guest may still pick, taken ones marked (T74).
  const slotEntries = computed(() =>
    model.value === 'slots' && listing.value ? buildSlotEntries(t, listing.value, availability.value, now.value) : [],
  )
  const selectedSlot = computed(() => slotEntries.value.find((slot) => slot.id === form.definedSlotId && !slot.taken) || null)
  // A slot handed over from the listing page that is gone or taken meanwhile is dropped.
  watch(
    slotEntries,
    (entries) => {
      if (form.definedSlotId && !entries.some((slot) => slot.id === form.definedSlotId && !slot.taken)) form.definedSlotId = null
    },
    { immediate: true },
  )

  const termBox = computed(() => {
    if (model.value === 'stay') return buildStayBox(t, listing.value, stayPick.value)
    // T127: a day without a free term has the alert instead of "pick a start".
    if (model.value === 'hours' && !dayWithoutTerms.value) {
      return buildHoursBox(t, form.startsAt, slotStartTime.value, slotDurationHours.value)
    }
    return null
  })

  const chosenTerm = computed(() => {
    if (model.value === 'stay') return form.startsAt && form.endsAt ? { startsAt: form.startsAt, endsAt: form.endsAt } : null
    if (model.value === 'months') return form.monthStart ? { monthStart: form.monthStart, monthCount: form.monthCount } : null
    if (model.value === 'slots') return selectedSlot.value
    return hoursRange.value
  })
  const termValue = computed(() => formatTermValue(t, model.value, chosenTerm.value))

  // T83: the term part of the exact shape /bookings and /bookings/quote both
  // expect, so the price shown is never computed for a different term than
  // the one sent. A stay starts and ends at UTC midnight of its dates, as the
  // calendar and the server key nights.
  const payload = computed(() => {
    if (model.value === 'slots') return selectedSlot.value ? { definedSlotId: selectedSlot.value.id } : null
    if (model.value === 'months') return form.monthStart ? { monthStart: form.monthStart, monthCount: form.monthCount } : null
    if (model.value === 'hours') {
      return hoursRange.value ? { startsAt: hoursRange.value.startsAt.toISOString(), endsAt: hoursRange.value.endsAt.toISOString() } : null
    }
    if (!form.startsAt || !form.endsAt) return null
    return { startsAt: `${form.startsAt}T00:00:00.000Z`, endsAt: `${form.endsAt}T00:00:00.000Z` }
  })

  // What a send without a term says, per model (T117: a vehicle or a machine
  // asks for its pickup and return days); none while the picker explains itself.
  function missingTermMessage() {
    if (payload.value || stayTooShort.value || monthBlocked.value) return ''
    const kind = model.value === 'stay' && pickupReturn.value ? 'pickup' : model.value
    return t(`bookingForm.termRequired.${kind}`)
  }

  // 373:608: "Promeni" starts the choice over (the fields clear the calendar).
  function clearStartTime() {
    slotStartTime.value = ''
  }

  return reactive({
    model,
    pickupReturn,
    form,
    stayPick,
    stayTooShort,
    monthBlocked,
    noMonthFree,
    minDurationMessage,
    handedStart,
    handedEnd,
    availableDaysOfWeek,
    slotStartTime,
    slotDurationHours,
    hourStarts,
    isHourDayOpen,
    dayWithoutTerms,
    termUnavailable,
    durationSelectOptions,
    closingHint,
    slotEntries,
    selectedSlot,
    termBox,
    chosenTerm,
    termValue,
    payload,
    onMonthSelect,
    onRangeUpdate,
    onMonthRangeUpdate,
    onSingleDateUpdate,
    missingTermMessage,
    clearStartTime,
  })
}
