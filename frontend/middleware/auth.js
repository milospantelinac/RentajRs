// Apply with `definePageMeta({ middleware: 'auth' })` on any page that
// requires a logged-in user (dashboard, checkout, listing wizard, etc.).
export default defineNuxtRouteMiddleware((to) => {
  const auth = useAuthStore()
  if (!auth.isAuthenticated) {
    return navigateTo({ path: '/prijava', query: { redirect: to.fullPath } })
  }
})
