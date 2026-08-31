// T98 — toLocaleString('sr-RS') with no options includes seconds by default
// ("16:53:07"), which is noise nobody reading a deadline or timestamp needs.
export function formatDateTime(value) {
  if (!value) return ''
  return new Date(value).toLocaleString('sr-RS', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
