// T143: every uploaded picture is kept in a few widths, one file each
// (.../{picture}/400.webp, 800.webp, ...). The backend's
// common/uploads/media.ts names the same widths; change both together. The API
// hands out the largest; these pick another one from that address, so a card
// or a phone does not download a photo made for a large screen. Anything else
// (a Google avatar, a photo not moved yet) has one size and is left as it is.
const MEDIA_WIDTHS = {
  photos: [400, 800, 1280, 1920],
  avatar: [128, 400],
  categories: [400, 800, 1600],
  'video-poster': [800, 1600],
}

const MEDIA_FILE =
  /\/(?:listings\/[^/]+\/(photos)|users\/[^/]+\/(avatar)|(categories)\/[^/]+|site\/homepage\/(video-poster))\/[0-9a-f-]{36}\/\d+\.webp$/

function mediaOf(url) {
  if (typeof url !== 'string') return null
  const match = url.match(MEDIA_FILE)
  if (!match) return null
  const widths = MEDIA_WIDTHS[match[1] || match[2] || match[3] || match[4]]
  return { widths, at: (width) => url.replace(/\/\d+\.webp$/, `/${width}.webp`) }
}

/** The picture at the smallest width that is at least `width` wide (the largest when none is). */
export function mediaVariant(url, width) {
  const media = mediaOf(url)
  if (!media) return url
  return media.at(media.widths.find((w) => w >= width) ?? media.widths[media.widths.length - 1])
}

/** Every width as a srcset, or undefined (no attribute at all) for a picture with one size. */
export function mediaSrcset(url) {
  const media = mediaOf(url)
  return media ? media.widths.map((w) => `${media.at(w)} ${w}w`).join(', ') : undefined
}
