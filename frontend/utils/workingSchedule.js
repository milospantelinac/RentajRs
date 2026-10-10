// T141: step 3's working hours as periods, each with a start, an end and an
// optional price, the way Figma 1700:3269 draws them. The API keeps each
// day's windows (WorkingHours) and the prices of parts of them
// (HourlyPriceRange): periods that touch make one window, a gap between them
// is a break, and a period with its own price is a price range.

const DAY_MINUTES = 24 * 60

export function minutesOfTime(time) {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

export function timeOfMinutes(total) {
  const minutes = ((total % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

// How long a period lasts; one that ends at or before its start runs past midnight (T104).
export function periodLength(period) {
  return (
    (minutesOfTime(period.to) - minutesOfTime(period.from) + DAY_MINUTES) % DAY_MINUTES ||
    DAY_MINUTES
  )
}

export function crossesMidnight(period) {
  return minutesOfTime(period.from) + periodLength(period) > DAY_MINUTES
}

function periodsOverlap(a, b) {
  const bAfterA = (minutesOfTime(b.from) - minutesOfTime(a.from) + DAY_MINUTES) % DAY_MINUTES
  const aAfterB = (minutesOfTime(a.from) - minutesOfTime(b.from) + DAY_MINUTES) % DAY_MINUTES
  return bAfterA < periodLength(a) || aAfterB < periodLength(b)
}

// The first two periods of a day that overlap, or null.
export function findOverlap(periods) {
  for (let i = 0; i < periods.length; i++) {
    for (let j = i + 1; j < periods.length; j++) {
      if (periodsOverlap(periods[i], periods[j])) return [periods[i], periods[j]]
    }
  }
  return null
}

function sortByStart(periods) {
  return [...periods].sort((a, b) => minutesOfTime(a.from) - minutesOfTime(b.from))
}

// One day's periods as the windows they make: a period that starts where
// another ends goes on from it, past midnight too.
export function periodsToWindows(periods) {
  const sorted = sortByStart(periods)
  const ends = new Set(sorted.map((period) => minutesOfTime(period.to)))
  const used = new Set()
  const windows = []
  const follow = (first) => {
    used.add(first)
    let end = first.to
    for (;;) {
      const next = sorted.find((period) => !used.has(period) && period.from === end)
      if (!next) break
      used.add(next)
      end = next.to
    }
    windows.push({ startsAt: first.from, endsAt: end })
  }
  for (const period of sorted)
    if (!used.has(period) && !ends.has(minutesOfTime(period.from))) follow(period)
  // Periods left over close a full circle (00:00 to 12:00 and 12:00 to 00:00): the whole day.
  for (const period of sorted) if (!used.has(period)) follow(period)
  return windows
}

// Each period with its own price, as the price of that part of the day.
export function periodsToRanges(periods, dayOfWeek = null) {
  return periods
    .filter((period) => Number(period.price) > 0)
    .map((period) => ({
      ...(dayOfWeek ? { dayOfWeek } : {}),
      startTime: period.from,
      endTime: period.to,
      price: Number(period.price),
    }))
}

function coversTime(startTime, endTime, time) {
  return startTime < endTime
    ? startTime <= time && time < endTime
    : time >= startTime || time < endTime
}

// The price a part of the day is booked at: that weekday's own range first,
// then one of every day (AvailabilityService pickHourlyPrice), else none.
function priceAt(ranges, dayOfWeek, time) {
  const covering = ranges.filter((range) => coversTime(range.startTime, range.endTime, time))
  const range =
    covering.find((candidate) => dayOfWeek != null && candidate.dayOfWeek === dayOfWeek) ||
    covering.find((candidate) => candidate.dayOfWeek == null)
  return range ? Number(range.price) : null
}

// One day's windows and prices back as periods: each window cut where a
// price starts or ends, neighbours with the same price joined again.
export function scheduleToPeriods(windows, ranges, dayOfWeek = null) {
  const periods = []
  const sorted = [...windows].sort((a, b) => minutesOfTime(a.startsAt) - minutesOfTime(b.startsAt))
  for (const window of sorted) {
    const start = minutesOfTime(window.startsAt)
    const length = (minutesOfTime(window.endsAt) - start + DAY_MINUTES) % DAY_MINUTES || DAY_MINUTES
    const cuts = new Set([0, length])
    for (const range of ranges) {
      for (const edge of [range.startTime, range.endTime]) {
        const offset = (minutesOfTime(edge) - start + DAY_MINUTES) % DAY_MINUTES
        if (offset > 0 && offset < length) cuts.add(offset)
      }
    }
    const points = [...cuts].sort((a, b) => a - b)
    let previous = null
    for (let i = 0; i < points.length - 1; i++) {
      const price = priceAt(ranges, dayOfWeek, timeOfMinutes(start + points[i]))
      const to = timeOfMinutes(start + points[i + 1])
      if (previous && previous.price === price) {
        previous.to = to
        continue
      }
      previous = { from: timeOfMinutes(start + points[i]), to, price }
      periods.push(previous)
    }
  }
  return periods
}

// Whether a day's periods leave a break between them.
export function hasBreak(periods) {
  return periods.length > 1 && periodsToWindows(periods).length > 1
}

// A new period for "+ Dodaj period": from where the latest one ends, two hours long.
export function nextPeriod(periods) {
  if (!periods.length) return { from: '10:00', to: '18:00', price: null }
  const last = sortByStart(periods).at(-1)
  const from = minutesOfTime(last.from) + periodLength(last)
  return { from: timeOfMinutes(from), to: timeOfMinutes(from + 120), price: null }
}
