// T143: the upload limits set in Administracija > Skladište (GET /upload-limits),
// for the pages that check a file before sending it. Until they arrive, or if
// they cannot be read, the defaults stand; the backend checks every file again.
const DEFAULT_LIMITS = { photoMaxMb: 8, attachmentMaxMb: 5 }

export function useUploadLimits() {
  const api = useApi()
  const { data } = useAsyncData('upload-limits', () => api.get('/upload-limits').catch(() => DEFAULT_LIMITS), {
    lazy: true,
    default: () => DEFAULT_LIMITS,
  })
  return computed(() => ({ ...DEFAULT_LIMITS, ...(data.value || {}) }))
}
