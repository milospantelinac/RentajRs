/**
 * T134: a Basic listing's phone, which the page only has masked ("062 *** ***").
 * The number is asked for once, on "Prikaži broj", and then shows in both
 * places that offer it (the owner block and the booking card).
 */
export function useOwnerPhone(listing) {
  const { t } = useI18n()
  const api = useApi()
  const key = `owner-phone-${listing.id}`
  const phone = useState(key, () => '')
  const revealing = useState(`${key}-busy`, () => false)
  const error = useState(`${key}-error`, () => '')

  const telHref = computed(() => `tel:${phone.value.replace(/[^\d+]/g, '')}`)

  async function reveal() {
    if (phone.value || revealing.value) return
    revealing.value = true
    error.value = ''
    try {
      const data = await api.get(`/listings/public/${listing.slug}/phone`)
      phone.value = data.phone
    } catch (e) {
      // The backend allows a visitor a few numbers a minute.
      error.value =
        e?.response?.status === 429
          ? t('listing.phoneRevealTooMany')
          : extractErrorMessage(e, t('listing.phoneRevealFailed'))
    } finally {
      revealing.value = false
    }
  }

  return { phone, telHref, revealing, error, reveal }
}
