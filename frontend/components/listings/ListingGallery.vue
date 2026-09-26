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
        <img :src="photo.url" :alt="photo.altText || title" class="listing-gallery-img" :loading="i === 0 ? 'eager' : 'lazy'" />
      </button>

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

function openLightbox(index) {
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
})
</script>

<style lang="scss" scoped>
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

@include respond-below(md) {
  .listing-gallery-grid-mosaic,
  .listing-gallery-grid-trio {
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr 1fr;
    aspect-ratio: 4 / 3;
  }

  .listing-gallery-grid-mosaic .listing-gallery-tile:nth-child(1),
  .listing-gallery-grid-trio .listing-gallery-tile:nth-child(1) {
    grid-row: auto;
  }

  .listing-gallery-grid-mosaic .listing-gallery-tile:nth-child(2) {
    grid-column: auto;
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
