<template>
  <div v-if="photos.length" class="listing-gallery">
    <div class="listing-gallery-grid" :class="'listing-gallery-grid-' + layout">
      <button
        v-for="(photo, i) in tilePhotos"
        :key="photo.id"
        type="button"
        class="listing-gallery-tile"
        :aria-label="t('listing.openGallery')"
        @click="openLightbox(i)"
      >
        <!-- T116: where the first photo is shown whole (a phone, one photo),
             a blurred copy of it fills the rest of the frame. -->
        <img v-if="i === 0" :src="photo.url" alt="" aria-hidden="true" class="listing-gallery-backdrop" />
        <img :src="photo.url" :alt="photo.altText || title" class="listing-gallery-img" :loading="i === 0 ? 'eager' : 'lazy'" />
      </button>

      <span v-if="photos.length > 1" class="listing-gallery-counter" :class="{ 'listing-gallery-counter-raised': videoUrl }">
        1 / {{ photos.length }}
      </span>

      <!-- Dizajn 11 — both overlays sit inside the mosaic, 20px in from the
           bottom-left and bottom-right corner respectively. -->
      <button v-if="videoUrl" type="button" class="listing-gallery-video-badge" @click="videoOpen = true">
        <img src="/images/icons/play-circle.svg" alt="" class="listing-gallery-video-icon" />
        {{ t('listing.watchVideo') }}
      </button>

      <button v-if="photos.length > 1" type="button" class="listing-gallery-all-btn" @click="openLightbox(0)">
        <img src="/images/icons/images-grid.svg" alt="" class="listing-gallery-all-icon" />
        {{ t(`listing.showAllPhotos${srPluralCategory(photos.length)}`, { count: photos.length }) }}
      </button>
    </div>

    <Teleport to="body">
      <div v-if="lightboxOpen" class="listing-lightbox" role="dialog" aria-modal="true" @click.self="lightboxOpen = false">
        <button type="button" class="listing-lightbox-close" :aria-label="t('common.close')" @click="lightboxOpen = false">
          <img src="/images/icons/close-x.svg" alt="" />
        </button>
        <button
          v-if="photos.length > 1"
          type="button"
          class="listing-lightbox-nav"
          :aria-label="t('listing.previousPhoto')"
          @click="step(-1)"
        >
          &lsaquo;
        </button>
        <figure class="listing-lightbox-figure">
          <img :src="photos[lightboxIndex]?.url" :alt="photos[lightboxIndex]?.altText || title" class="listing-lightbox-img" />
          <figcaption class="listing-lightbox-counter">{{ lightboxIndex + 1 }} / {{ photos.length }}</figcaption>
        </figure>
        <button
          v-if="photos.length > 1"
          type="button"
          class="listing-lightbox-nav"
          :aria-label="t('listing.nextPhoto')"
          @click="step(1)"
        >
          &rsaquo;
        </button>
      </div>

      <div v-if="videoOpen" class="listing-lightbox" role="dialog" aria-modal="true" @click.self="videoOpen = false">
        <button type="button" class="listing-lightbox-close" :aria-label="t('common.close')" @click="videoOpen = false">
          <img src="/images/icons/close-x.svg" alt="" />
        </button>
        <div class="listing-lightbox-video">
          <iframe
            v-if="youtubeEmbedUrl"
            :src="youtubeEmbedUrl"
            title="YouTube"
            frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen
          ></iframe>
          <video v-else :src="videoUrl" controls autoplay></video>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
// Dizajn 11 — the listing page's photo mosaic (Figma 101:3): one tall photo on
// the left, one wide and two half-width ones on the right, with the video and
// "all photos" buttons floating inside it. Fewer than four photos falls back to
// a layout that still reads as deliberate instead of leaving holes in the grid.
const props = defineProps({
  photos: { type: Array, default: () => [] },
  title: { type: String, default: '' },
  videoUrl: { type: String, default: null },
})

const { t } = useI18n()

const layout = computed(() => {
  if (props.photos.length >= 4) return 'mosaic'
  if (props.photos.length === 3) return 'trio'
  if (props.photos.length === 2) return 'duo'
  return 'single'
})

const tilePhotos = computed(() => props.photos.slice(0, props.photos.length >= 4 ? 4 : props.photos.length))

// The wizard only saves links utils/youtube.js recognises (Dizajn 20), so the
// <video> fallback is left for links saved before that.
const youtubeEmbedUrl = computed(() => {
  const id = getYoutubeVideoId(props.videoUrl)
  return id ? 'https://www.youtube.com/embed/' + id + '?autoplay=1' : null
})

const lightboxOpen = ref(false)
const lightboxIndex = ref(0)
const videoOpen = ref(false)

// T116: a phone opens the photos in PhotoSwipe instead, across the whole
// screen in either orientation and never cropped, with pinch and double-tap
// zoom and a swipe to the next one. A phone held sideways is wider than the
// phone breakpoint, so a short touch screen counts as a phone too.
const PHONE_VIEWER_QUERY = '(max-width: 767.98px), (max-height: 500px) and (pointer: coarse)'
// PhotoSwipe lays a slide out by its photo's size, which the API does not
// send. T116 (Tamara, 2026-10-10, iPhone): a slide laid out before its size
// was known came out stretched to the fallback, and the photos PhotoSwipe
// loads ahead never told their size at all (squashed from the third one
// on); rebuilding a slide from inside PhotoSwipe's own load event (Safari has
// a cached photo loaded at once) left the old slide on screen behind the new
// one, the same photo twice. So sizes are read ahead, the opened photo before
// the viewer opens and the next ones while it is open, and a slide laid out
// too early is rebuilt once its size is in, after PhotoSwipe is done with it.
const FALLBACK_PHOTO_SIZE = { width: 1600, height: 1200 }
const photoSizes = new Map()
const sizeLoads = new Map()
let phoneViewer = null

function loadPhotoSize(url) {
  if (!sizeLoads.has(url)) {
    sizeLoads.set(
      url,
      new Promise((resolve) => {
        const image = new Image()
        image.onload = () => {
          photoSizes.set(url, { width: image.naturalWidth, height: image.naturalHeight })
          resolve(photoSizes.get(url))
        }
        image.onerror = () => {
          sizeLoads.delete(url)
          resolve(null)
        }
        image.src = url
      }),
    )
  }
  return sizeLoads.get(url)
}

function wholeOnScreen(zoom) {
  return Math.min(zoom.panAreaSize.x / zoom.elementSize.x, zoom.panAreaSize.y / zoom.elementSize.y)
}

// The photos from `back` before `index` to `ahead` after it, round the end.
function photosAround(index, back, ahead) {
  const count = props.photos.length
  const indexes = new Set()
  for (let step = -back; step <= ahead; step++) indexes.add((((index + step) % count) + count) % count)
  return [...indexes]
}

async function openPhoneViewer(index) {
  const [{ default: PhotoSwipe }] = await Promise.all([
    import('photoswipe'),
    import('photoswipe/style.css'),
  ])
  // The photo that opens has its size from the start (the mosaic usually has it loaded already).
  await loadPhotoSize(props.photos[index].url)
  const dataSource = props.photos.map((photo) => ({
    src: photo.url,
    alt: photo.altText || props.title,
    ...(photoSizes.get(photo.url) || FALLBACK_PHOTO_SIZE),
  }))
  const viewer = new PhotoSwipe({
    dataSource,
    index,
    mainClass: 'listing-photo-viewer',
    bgOpacity: 1,
    padding: { top: 0, bottom: 0, left: 0, right: 0 },
    // Every photo as large as the screen takes it whole, a smaller one too
    // (PhotoSwipe's "fit" never goes past a photo's own size); a double tap
    // zooms in from there.
    initialZoomLevel: wholeOnScreen,
    secondaryZoomLevel: (zoom) => (zoom.initial < 1 ? Math.min(1, zoom.initial * 3) : zoom.initial * 2),
    showHideAnimationType: 'fade',
    indexIndicatorSep: ' / ',
    closeTitle: t('common.close'),
    zoomTitle: t('listing.zoomPhoto'),
    arrowPrevTitle: t('listing.previousPhoto'),
    arrowNextTitle: t('listing.nextPhoto'),
    errorMsg: t('listing.photoLoadError'),
  })
  phoneViewer = viewer

  // A size learnt for a photo whose slide was laid out with another one. The
  // rebuild waits for PhotoSwipe to finish what it is doing; it also drops the
  // photo PhotoSwipe loaded ahead with the old size.
  function applySize(slideIndex, size) {
    const item = dataSource[slideIndex]
    if (!size || !item || (item.width === size.width && item.height === size.height)) return
    item.width = size.width
    item.height = size.height
    setTimeout(() => {
      if (phoneViewer === viewer) viewer.refreshSlideContent(slideIndex)
    })
  }
  // PhotoSwipe keeps one photo back and two ahead; their sizes come first.
  function readAhead(current) {
    for (const slideIndex of photosAround(current, 2, 3)) {
      loadPhotoSize(props.photos[slideIndex].url).then((size) => applySize(slideIndex, size))
    }
  }
  viewer.on('change', () => readAhead(viewer.currIndex))
  // Anything still laid out with another size than the one it loaded with.
  viewer.on('loadComplete', ({ content }) => {
    const image = content.element
    if (image?.naturalWidth) applySize(content.index, { width: image.naturalWidth, height: image.naturalHeight })
  })
  viewer.on('destroy', () => {
    if (phoneViewer === viewer) phoneViewer = null
  })
  viewer.init()
  readAhead(index)
}

function openLightbox(index) {
  if (window.matchMedia(PHONE_VIEWER_QUERY).matches) {
    openPhoneViewer(index)
    return
  }
  lightboxIndex.value = index
  lightboxOpen.value = true
}

function step(delta) {
  const count = props.photos.length
  lightboxIndex.value = (lightboxIndex.value + delta + count) % count
}

function onKeydown(event) {
  if (!lightboxOpen.value && !videoOpen.value) return
  if (event.key === 'Escape') {
    lightboxOpen.value = false
    videoOpen.value = false
  }
  if (!lightboxOpen.value) return
  if (event.key === 'ArrowRight') step(1)
  if (event.key === 'ArrowLeft') step(-1)
}

// An overlay that outlives its trigger would leave the page permanently
// unscrollable, so the lock is released on unmount as well as on close.
watch([lightboxOpen, videoOpen], ([photosOpen, videoIsOpen]) => {
  document.body.style.overflow = photosOpen || videoIsOpen ? 'hidden' : ''
})

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
  phoneViewer?.destroy()
})
</script>

<style lang="scss" scoped>
// T116 (Tamara, 2026-10-10): a photo shown whole sits on a blurred copy of
// itself, so the frame keeps its shape with nothing cut off and no empty
// bands, and a hairline keeps the rounded edge in sight on a white photo.
@mixin gallery-backdrop-shown {
  display: block;
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: blur(24px) brightness(0.9);
  transform: scale(1.2);
}

@mixin gallery-photo-whole {
  position: relative;
  object-fit: contain;
}

@mixin gallery-hairline {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  box-shadow: inset 0 0 0 1px rgba(6, 27, 49, 0.08);
  pointer-events: none;
}

.listing-gallery-grid {
  position: relative;
  display: grid;
  gap: 8px;
  border-radius: 15px;
  overflow: hidden;
}

// 600 / 300 / 300 columns with 8px gutters reproduce Figma's 1216x480 mosaic at
// any container width; the aspect ratio keeps those proportions on the way down
// instead of pinning a desktop-only 480px height.
.listing-gallery-grid-mosaic {
  grid-template-columns: 600fr 300fr 300fr;
  grid-template-rows: 1fr 1fr;
  aspect-ratio: 1216 / 480;
}

.listing-gallery-grid-mosaic .listing-gallery-tile:nth-child(1) {
  grid-row: 1 / 3;
}

.listing-gallery-grid-mosaic .listing-gallery-tile:nth-child(2) {
  grid-column: 2 / 4;
}

.listing-gallery-grid-trio {
  grid-template-columns: 608fr 608fr;
  grid-template-rows: 1fr 1fr;
  aspect-ratio: 1216 / 480;
}

.listing-gallery-grid-trio .listing-gallery-tile:nth-child(1) {
  grid-row: 1 / 3;
}

.listing-gallery-grid-duo {
  grid-template-columns: 1fr 1fr;
  aspect-ratio: 1216 / 480;
}

.listing-gallery-grid-single {
  grid-template-columns: 1fr;
  aspect-ratio: 1216 / 480;
}

// T116: one photo is shown whole in the wide frame, not cut to a strip.
.listing-gallery-backdrop {
  display: none;
}

.listing-gallery-grid-single .listing-gallery-backdrop {
  @include gallery-backdrop-shown;
}

.listing-gallery-grid-single .listing-gallery-img {
  @include gallery-photo-whole;
}

.listing-gallery-grid-single::after {
  @include gallery-hairline;
}

// T116: a phone's "1 / 6" over the photo's bottom-left corner, above
// "Pogledaj video" when the listing has one.
.listing-gallery-counter {
  display: none;
  position: absolute;
  left: 12px;
  bottom: 12px;
  align-items: center;
  height: 28px;
  padding: 0 10px;
  border-radius: $radius-pill;
  background: rgba(6, 27, 49, 0.6);
  color: $color-surface;
  font-size: 13px;
  font-weight: 500;
  pointer-events: none;
}

.listing-gallery-tile {
  position: relative;
  padding: 0;
  border: 0;
  background: $color-background;
  cursor: pointer;
  overflow: hidden;
}

.listing-gallery-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.3s ease;
}

.listing-gallery-tile:hover .listing-gallery-img {
  transform: scale(1.03);
}

.listing-gallery-video-badge,
.listing-gallery-all-btn {
  position: absolute;
  display: inline-flex;
  align-items: center;
  background: $color-surface;
  border: 0;
  color: $color-text;
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  box-shadow: 0 6px 18px rgba(97, 115, 133, 0.08);
}

.listing-gallery-video-badge {
  left: 20px;
  bottom: 20px;
  height: 40px;
  gap: 8px;
  padding: 0 16px 0 14px;
  border-radius: $radius-pill;
}

.listing-gallery-video-icon {
  width: 18px;
  height: 18px;
}

.listing-gallery-all-btn {
  right: 20px;
  bottom: 20px;
  height: 44px;
  gap: 9px;
  padding: 0 20px 0 18px;
  border-radius: 8px;
}

.listing-gallery-all-icon {
  width: 17px;
  height: 17px;
}

.listing-lightbox {
  position: fixed;
  inset: 0;
  z-index: $z-modal;
  background: rgba(6, 27, 49, 0.92);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 64px 24px;
}

.listing-lightbox-close {
  position: absolute;
  top: 20px;
  right: 24px;
  width: 44px;
  height: 44px;
  border: 0;
  border-radius: $radius-pill;
  background: $color-surface;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.listing-lightbox-close img {
  width: 16px;
  height: 16px;
}

.listing-lightbox-nav {
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  border: 0;
  border-radius: $radius-pill;
  background: rgba(255, 255, 255, 0.14);
  color: $color-surface;
  font-size: 32px;
  line-height: 1;
  cursor: pointer;
}

.listing-lightbox-figure {
  margin: 0 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.listing-lightbox-img {
  max-width: min(1100px, 100%);
  max-height: 78vh;
  object-fit: contain;
  border-radius: $radius-card;
}

.listing-lightbox-counter {
  color: rgba(255, 255, 255, 0.72);
  font-size: $font-size-body;
}

.listing-lightbox-video {
  width: min(1100px, 100%);
  aspect-ratio: 16 / 9;
  border-radius: $radius-card;
  overflow: hidden;
}

.listing-lightbox-video iframe,
.listing-lightbox-video video {
  width: 100%;
  height: 100%;
  border: 0;
  display: block;
}

// T116 (agreed 2026-10-11): a phone shows one photo, the cover, whole in a 4:3
// frame on every listing; "Prikaži sve" or a tap opens the rest.
@include respond-below(md) {
  .listing-gallery-grid-mosaic,
  .listing-gallery-grid-trio,
  .listing-gallery-grid-duo,
  .listing-gallery-grid-single {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr);
    aspect-ratio: 4 / 3;
  }

  .listing-gallery-grid-mosaic .listing-gallery-tile:nth-child(1),
  .listing-gallery-grid-trio .listing-gallery-tile:nth-child(1) {
    grid-row: auto;
  }

  .listing-gallery-tile + .listing-gallery-tile {
    display: none;
  }

  .listing-gallery-tile:first-child .listing-gallery-backdrop {
    @include gallery-backdrop-shown;
  }

  .listing-gallery-tile:first-child .listing-gallery-img {
    @include gallery-photo-whole;
  }

  .listing-gallery-grid::after {
    @include gallery-hairline;
  }

  .listing-gallery-counter {
    display: inline-flex;
  }

  .listing-gallery-counter-raised {
    bottom: 56px;
  }

  .listing-gallery-video-badge,
  .listing-gallery-all-btn {
    height: 36px;
    font-size: 13px;
    left: 12px;
    right: auto;
    bottom: 12px;
  }

  .listing-gallery-all-btn {
    left: auto;
    right: 12px;
  }
}
</style>

<style lang="scss">
// T116: PhotoSwipe puts its dialog at the end of <body>, outside this
// component's scope; its backdrop is the desktop lightbox's navy.
.pswp.listing-photo-viewer {
  --pswp-bg: #{$color-text};
}
</style>
