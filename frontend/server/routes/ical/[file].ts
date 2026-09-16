// Dizajn 33: the calendar feed an owner pastes into Airbnb or Booking.com lives
// on the site's own address (https://rentaj.rs/ical/<token>.ics), whatever host
// and version the API has. This passes the request on to the backend's
// /ical/<token>.ics and hands the calendar back as it is.
const FEED_FILE = /^[A-Za-z0-9-]{1,64}\.ics$/

export default defineEventHandler(async (event) => {
  const method = event.method
  if (method !== 'GET' && method !== 'HEAD') {
    setResponseHeader(event, 'allow', 'GET, HEAD')
    throw createError({ statusCode: 405 })
  }

  const file = getRouterParam(event, 'file') || ''
  if (!FEED_FILE.test(file)) throw createError({ statusCode: 404 })

  const config = useRuntimeConfig()
  let response: Response
  try {
    response = await fetch(`${config.apiBaseInternal}/ical/${file}`, { signal: AbortSignal.timeout(15_000) })
  } catch {
    throw createError({ statusCode: 502 })
  }
  if (response.status === 404) throw createError({ statusCode: 404 })
  if (!response.ok) throw createError({ statusCode: 502 })

  setResponseHeaders(event, {
    'content-type': 'text/calendar; charset=utf-8',
    'cache-control': 'no-store',
  })
  // Node leaves the body out of a HEAD response on its own.
  return await response.text()
})
