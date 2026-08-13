// Runs on both server (per-request) and client (once, on boot) so a
// logged-in visitor's SSR-rendered HTML already reflects their session
// instead of flashing a logged-out header first.
//
// @pinia/nuxt hydrates store state from the server payload automatically,
// so by the time this plugin runs on the client, `auth.initialized` is
// already true if SSR already resolved it — re-running initFromCookies()
// here would re-hit /users/me a second time and, if the access token
// happens to expire in the gap between the SSR response and client
// hydration, produce a header that renders logged-in then immediately
// flips to logged-out (a hydration mismatch). Skipping the redundant call
// when SSR already did the work avoids both problems.
export default defineNuxtPlugin(async () => {
  const auth = useAuthStore()
  if (auth.initialized) return
  await auth.initFromCookies()
})
