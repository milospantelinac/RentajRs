// The video links a listing accepts (Dizajn 20): youtube.com/watch?v=, /embed/ and
// /shorts/ links (bare, www. or m.) and youtu.be links. UpdateListingDto.videoUrl
// checks the same pattern, so a link the wizard marks as recognised always saves
// and always plays in ListingGallery.
const YOUTUBE_URL = /^(?:https?:\/\/)?(?:(?:www|m)\.)?(?:youtube\.com\/(?:watch\?(?:[^#\s]*&)?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})(?:[?&#/]\S*)?$/i

/** The 11-character video id, or null when the link isn't a YouTube video. */
export function getYoutubeVideoId(url) {
  if (typeof url !== 'string') return null
  const match = url.trim().match(YOUTUBE_URL)
  return match ? match[1] : null
}
