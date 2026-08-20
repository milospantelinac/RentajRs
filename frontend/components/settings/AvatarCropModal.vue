<template>
  <Teleport to="body">
    <div class="cropper-backdrop" @click.self="$emit('cancel')">
      <div class="cropper-modal card">
        <h3 class="cropper-title">{{ t('dashboard.avatarCropTitle') }}</h3>
        <p class="text-muted cropper-subtitle">{{ t('dashboard.avatarCropHint') }}</p>

        <div
          ref="viewportRef"
          class="cropper-viewport"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="onPointerUp"
          @wheel.prevent="onWheel"
        >
          <img
            v-if="imageUrl"
            ref="imgRef"
            :src="imageUrl"
            class="cropper-image"
            :style="imageStyle"
            draggable="false"
            alt=""
            @load="onImageLoad"
          />
        </div>

        <div class="cropper-zoom-row">
          <FontAwesomeIcon icon="magnifying-glass" class="cropper-zoom-icon cropper-zoom-icon-sm" />
          <input v-model.number="zoom" type="range" min="1" max="3" step="0.01" class="cropper-zoom-slider" @input="clampOffsets" />
          <FontAwesomeIcon icon="magnifying-glass" class="cropper-zoom-icon cropper-zoom-icon-lg" />
        </div>

        <div class="cropper-actions">
          <button type="button" class="btn btn-tertiary" @click="$emit('cancel')">{{ t('common.cancel') }}</button>
          <button type="button" class="btn btn-primary-flat" :disabled="!imageReady" @click="onConfirm">{{ t('common.confirm') }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
// A minimal home-grown circular pan/zoom cropper — drag to pan, wheel/slider/
// pinch to zoom. Crops to the circle's own square bounding box (not a true
// circular PNG): every avatar in the app is already displayed with CSS
// border-radius:50%, so a square source image is all that's needed, and it
// keeps the canvas math (and the upload) simple.
const props = defineProps({ file: { type: File, required: true } })
const emit = defineEmits(['confirm', 'cancel'])
const { t } = useI18n()

const VIEWPORT_SIZE = 260
const MAX_ZOOM = 3

const imageUrl = ref('')
const imgRef = ref(null)
const viewportRef = ref(null)
const naturalWidth = ref(0)
const naturalHeight = ref(0)
const baseScale = ref(1)
const zoom = ref(1)
const offsetX = ref(0)
const offsetY = ref(0)
const imageReady = ref(false)

onMounted(() => {
  imageUrl.value = URL.createObjectURL(props.file)
})

onBeforeUnmount(() => {
  if (imageUrl.value) URL.revokeObjectURL(imageUrl.value)
})

function onImageLoad() {
  naturalWidth.value = imgRef.value.naturalWidth
  naturalHeight.value = imgRef.value.naturalHeight
  // "Cover" scale: the image's shorter side fills the circular viewport exactly at zoom=1.
  baseScale.value = VIEWPORT_SIZE / Math.min(naturalWidth.value, naturalHeight.value)
  zoom.value = 1
  offsetX.value = 0
  offsetY.value = 0
  imageReady.value = true
}

const currentScale = computed(() => baseScale.value * zoom.value)

const imageStyle = computed(() => ({
  width: `${naturalWidth.value * currentScale.value}px`,
  height: `${naturalHeight.value * currentScale.value}px`,
  transform: `translate(calc(-50% + ${offsetX.value}px), calc(-50% + ${offsetY.value}px))`,
}))

function clampOffsets() {
  const renderedWidth = naturalWidth.value * currentScale.value
  const renderedHeight = naturalHeight.value * currentScale.value
  const maxX = Math.max(0, (renderedWidth - VIEWPORT_SIZE) / 2)
  const maxY = Math.max(0, (renderedHeight - VIEWPORT_SIZE) / 2)
  offsetX.value = Math.min(maxX, Math.max(-maxX, offsetX.value))
  offsetY.value = Math.min(maxY, Math.max(-maxY, offsetY.value))
}

// Pan (1 pointer) and pinch-zoom (2 pointers) share one pointer-event map —
// Pointer Events already unify mouse/touch/pen for the single-finger case,
// so only the 2-finger pinch distance needs its own tracking.
const activePointers = new Map()
const dragStart = { x: 0, y: 0, offsetX: 0, offsetY: 0 }
let dragging = false
let pinchStartDistance = 0
let pinchStartZoom = 1

function pointerDistance() {
  const pts = [...activePointers.values()]
  return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
}

function beginDragFrom(point) {
  dragging = true
  dragStart.x = point.x
  dragStart.y = point.y
  dragStart.offsetX = offsetX.value
  dragStart.offsetY = offsetY.value
}

function onPointerDown(e) {
  if (!imageReady.value) return
  viewportRef.value.setPointerCapture(e.pointerId)
  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
  if (activePointers.size === 2) {
    dragging = false
    pinchStartDistance = pointerDistance()
    pinchStartZoom = zoom.value
  } else if (activePointers.size === 1) {
    beginDragFrom({ x: e.clientX, y: e.clientY })
  }
}

function onPointerMove(e) {
  if (!activePointers.has(e.pointerId)) return
  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

  if (activePointers.size === 2 && pinchStartDistance > 0) {
    const ratio = pointerDistance() / pinchStartDistance
    zoom.value = Math.min(MAX_ZOOM, Math.max(1, pinchStartZoom * ratio))
    clampOffsets()
  } else if (dragging) {
    offsetX.value = dragStart.offsetX + (e.clientX - dragStart.x)
    offsetY.value = dragStart.offsetY + (e.clientY - dragStart.y)
    clampOffsets()
  }
}

function onPointerUp(e) {
  activePointers.delete(e.pointerId)
  if (activePointers.size === 0) {
    dragging = false
    pinchStartDistance = 0
  } else if (activePointers.size === 1) {
    const [[, point]] = activePointers
    pinchStartDistance = 0
    beginDragFrom(point)
  }
}

function onWheel(e) {
  if (!imageReady.value) return
  zoom.value = Math.min(MAX_ZOOM, Math.max(1, zoom.value - e.deltaY * 0.002))
  clampOffsets()
}

function onConfirm() {
  const scale = currentScale.value
  const renderedWidth = naturalWidth.value * scale
  const renderedHeight = naturalHeight.value * scale
  const cropLeft = (renderedWidth / 2 - VIEWPORT_SIZE / 2 - offsetX.value) / scale
  const cropTop = (renderedHeight / 2 - VIEWPORT_SIZE / 2 - offsetY.value) / scale
  const cropSize = VIEWPORT_SIZE / scale

  const OUTPUT_SIZE = 400 // matches the backend's avatar resize target
  const canvas = document.createElement('canvas')
  canvas.width = OUTPUT_SIZE
  canvas.height = OUTPUT_SIZE
  const ctx = canvas.getContext('2d')
  ctx.drawImage(imgRef.value, cropLeft, cropTop, cropSize, cropSize, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE)
  canvas.toBlob(
    (blob) => {
      if (blob) emit('confirm', blob)
    },
    'image/jpeg',
    0.92,
  )
}
</script>

<style lang="scss" scoped>
.cropper-backdrop {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(6, 27, 49, 0.55);
  z-index: $z-modal;
}

.cropper-modal {
  width: 100%;
  max-width: 360px;
  padding: 24px;
  text-align: center;
}

.cropper-title {
  font-size: $font-size-section-title;
  font-weight: 600;
  color: $color-text;
  margin: 0 0 4px;
}

.cropper-subtitle {
  font-size: $font-size-muted;
  margin: 0 0 20px;
}

.cropper-viewport {
  width: 260px;
  height: 260px;
  margin: 0 auto;
  position: relative;
  overflow: hidden;
  border-radius: $radius-pill;
  background: $color-background;
  touch-action: none;
  cursor: grab;
  box-shadow: 0 0 0 4px $color-background, 0 0 0 5px $color-border;
}

.cropper-viewport:active {
  cursor: grabbing;
}

.cropper-image {
  position: absolute;
  left: 50%;
  top: 50%;
  max-width: none;
  user-select: none;
  -webkit-user-drag: none;
}

.cropper-zoom-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 20px 0 4px;
}

.cropper-zoom-icon {
  color: $color-text-muted;
  flex-shrink: 0;
}

.cropper-zoom-icon-sm {
  width: 12px;
  height: 12px;
}

.cropper-zoom-icon-lg {
  width: 18px;
  height: 18px;
}

.cropper-zoom-slider {
  flex: 1;
}

.cropper-actions {
  display: flex;
  gap: 12px;
  margin-top: 20px;
}

.cropper-actions .btn {
  flex: 1;
}
</style>
