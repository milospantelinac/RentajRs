// Applied with `definePageMeta({ middleware: ['auth', 'admin'] })` on every /admin page.
export default defineNuxtRouteMiddleware(() => {
  const auth = useAuthStore()
  if (!auth.user?.isAdmin) {
    return navigateTo('/kontrolna-tabla')
  }
})
