<template>
  <!-- Administracija > Sadržaj > Video na početnoj (no frame): the video kept on
       our own server, uploaded in parts with no size limit (the user,
       2026-11-18: "te videe želim na svom serveru", not in the bucket). -->
  <div class="admin-card server-video-card">
    <div class="server-video-head">
      <div>
        <p class="admin-card-title">{{ t('admin.serverVideo.title') }}</p>
        <p class="admin-card-note">{{ t('admin.serverVideo.hint') }}</p>
      </div>
      <span v-if="video.showing === 'upload'" class="admin-pill admin-pill-success">{{ t('admin.homepageVideoShowing') }}</span>
      <button
        v-else-if="video.upload && !busy"
        type="button"
        class="admin-action"
        :disabled="switching"
        @click="showOnHomepage"
      >
        {{ t('admin.homepageVideoShowThis') }}
      </button>
    </div>

    <div v-if="video.upload && !busy" class="server-video-current">
      <video :src="previewSrc" class="server-video-preview" controls preload="metadata" playsinline />
      <p class="server-video-meta">
        <span class="server-video-name">{{ video.upload.name }}</span>
        <span>{{ formatFileSize(video.upload.size) }}</span>
        <span v-if="codecLabel">{{ codecLabel }}</span>
        <span v-if="video.upload.uploadedAt">{{ t('admin.serverVideo.uploadedAt', { date: formatDate(video.upload.uploadedAt) }) }}</span>
      </p>
      <p v-if="formatWarning" class="server-video-warning">{{ formatWarning }}</p>
    </div>

    <div v-if="busy || phase === 'failed'" class="server-video-progress">
      <p class="server-video-file">{{ pickedFile?.name }}</p>
      <div
        class="server-video-meter"
        role="progressbar"
        :aria-valuenow="percent"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-label="t('admin.serverVideo.progressLabel')"
      >
        <span :style="{ width: `${percent}%` }" />
      </div>
      <p class="server-video-status">
        <template v-if="phase === 'finishing'">{{ t('admin.serverVideo.finishing') }}</template>
        <template v-else>
          {{ t('admin.serverVideo.progress', { done: formatFileSize(received), total: formatFileSize(total), percent }) }}
          <template v-if="speedText"> · {{ speedText }}</template>
        </template>
      </p>
      <p v-if="retrying && phase === 'sending'" class="admin-card-note">{{ t('admin.serverVideo.retrying') }}</p>
      <p v-else-if="busy" class="admin-card-note">{{ t('admin.serverVideo.keepOpen') }}</p>
    </div>

    <p v-if="error" class="form-error">{{ error }}</p>

    <div class="server-video-actions">
      <template v-if="busy">
        <button type="button" class="btn btn-tertiary btn-sm" :disabled="phase === 'finishing'" @click="cancel">
          {{ t('admin.serverVideo.cancel') }}
        </button>
      </template>
      <template v-else>
        <button v-if="phase === 'failed'" type="button" class="btn btn-primary-flat btn-sm" @click="resume">
          {{ t('admin.serverVideo.resume') }}
        </button>
        <label class="btn btn-tertiary btn-sm">
          {{ video.upload ? t('admin.serverVideo.replace') : t('admin.serverVideo.upload') }}
          <input type="file" :accept="ACCEPT" class="visually-hidden" @change="onPick" />
        </label>
        <button v-if="phase === 'failed'" type="button" class="admin-action" @click="dropFailed">
          {{ t('admin.serverVideo.dropUpload') }}
        </button>
        <button v-if="video.upload" type="button" class="admin-action admin-action-danger" :disabled="removing" @click="remove">
          {{ t('admin.serverVideo.remove') }}
        </button>
      </template>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  /** GET /admin/homepage-video: { link, thumbnailUrl, upload, source, showing }. */
  video: { type: Object, required: true },
})
const emit = defineEmits(['update'])

const { t } = useI18n()
const api = useApi()
const config = useRuntimeConfig()

const BASE = '/admin/homepage-video'
// The server decides by the file's bytes; this only keeps other files out of the picker.
const ACCEPT = 'video/mp4,video/webm,video/quicktime,.mp4,.m4v,.mov,.webm'
const VIDEO_EXTENSIONS = /\.(mp4|m4v|mov|webm)$/i
// What a track's sample entry type means, for the admin.
const CODEC_NAMES = {
  avc1: 'H.264',
  avc3: 'H.264',
  hvc1: 'HEVC (H.265)',
  hev1: 'HEVC (H.265)',
  dvh1: 'Dolby Vision',
  dvhe: 'Dolby Vision',
  av01: 'AV1',
  vp09: 'VP9',
  vp08: 'VP8',
  mp4v: 'MPEG-4 Part 2',
}

// idle, starting, sending, finishing, failed
const phase = ref('idle')
const pickedFile = ref(null)
const upload = ref(null)
const received = ref(0)
const total = ref(0)
const retrying = ref(0)
const error = ref('')
const switching = ref(false)
const removing = ref(false)
const run = reactive({ startedAt: 0, startBytes: 0, now: 0 })
let controller = null

const busy = computed(() => ['starting', 'sending', 'finishing'].includes(phase.value))
const percent = computed(() => (total.value ? Math.floor((received.value / total.value) * 100) : 0))
const previewSrc = computed(() => (props.video.upload ? `${config.public.apiBase}/videos/${props.video.upload.file}` : ''))

const videoCodec = computed(() => props.video.upload?.codecs?.find((codec) => CODEC_NAMES[codec]) || null)
const codecLabel = computed(() => {
  if (props.video.upload?.type === 'video/webm') return 'WebM'
  return videoCodec.value ? CODEC_NAMES[videoCodec.value] : ''
})
const formatWarning = computed(() => {
  const current = props.video.upload
  if (!current) return ''
  if (current.type === 'video/webm') return t('admin.serverVideo.webmWarning')
  const h264 = current.codecs?.some((codec) => codec === 'avc1' || codec === 'avc3')
  return videoCodec.value && !h264 ? t('admin.serverVideo.codecWarning', { codec: codecLabel.value }) : ''
})

// Speed and time left once a couple of seconds of this run are in.
const speedText = computed(() => {
  const seconds = (run.now - run.startedAt) / 1000
  const sent = received.value - run.startBytes
  if (phase.value !== 'sending' || seconds < 2 || sent <= 0) return ''
  const perSecond = sent / seconds
  const left = (total.value - received.value) / perSecond
  return t('admin.serverVideo.speed', { speed: formatFileSize(perSecond), left: formatDuration(left) })
})

function formatDuration(seconds) {
  const s = Math.max(1, Math.round(seconds))
  if (s >= 3600) return `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min`
  if (s >= 60) return `${Math.round(s / 60)} min`
  return `${s} s`
}

function formatDate(value) {
  return new Date(value).toLocaleDateString('sr-RS', { day: 'numeric', month: 'numeric', year: 'numeric' })
}

function looksLikeVideo(file) {
  return file.type.startsWith('video/') || VIDEO_EXTENSIONS.test(file.name)
}

async function onPick(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  error.value = ''
  if (!looksLikeVideo(file)) {
    error.value = t('admin.serverVideo.notVideo')
    return
  }
  pickedFile.value = file
  upload.value = null
  received.value = 0
  total.value = file.size
  phase.value = 'starting'
  try {
    // The same file picked again (after a reload too) carries on where it stopped.
    upload.value = await api.post(`${BASE}/uploads`, {
      fileName: file.name,
      size: file.size,
      lastModified: Math.max(0, Math.floor(file.lastModified || 0)),
    })
  } catch (e) {
    phase.value = 'idle'
    error.value = extractErrorMessage(e, t('auth.genericError'))
    return
  }
  await send()
}

async function send() {
  const file = pickedFile.value
  if (!file || !upload.value) return
  controller = new AbortController()
  const { signal } = controller
  error.value = ''
  retrying.value = 0
  phase.value = 'sending'
  run.startedAt = Date.now()
  run.now = run.startedAt
  run.startBytes = upload.value.received
  try {
    await uploadInParts({
      api,
      url: `${BASE}/uploads`,
      file,
      upload: upload.value,
      signal,
      onProgress: (bytes) => {
        if (retrying.value) {
          // Speed counts from where this stretch of sending started.
          run.startedAt = Date.now()
          run.startBytes = bytes
        }
        received.value = bytes
        run.now = Date.now()
        retrying.value = 0
      },
      onRetry: (attempt) => {
        retrying.value = attempt
      },
    })
    phase.value = 'finishing'
    const state = await api.post(`${BASE}/uploads/${upload.value.id}/complete`, {}, { signal })
    emit('update', state)
    reset()
  } catch (e) {
    if (signal.aborted) return
    const message = extractErrorMessage(e, '')
    const status = errorStatus(e)
    // A refusal (not a video, no room on the server) ends this upload; a broken
    // connection leaves it waiting on the server to be carried on.
    if (status && !isRetryable(status)) {
      reset()
      error.value = message || t('auth.genericError')
    } else {
      phase.value = 'failed'
      upload.value = { ...upload.value, received: received.value }
      error.value = t('admin.serverVideo.failed')
    }
  } finally {
    controller = null
  }
}

async function resume() {
  if (!upload.value) return
  try {
    upload.value = await api.get(`${BASE}/uploads/${upload.value.id}`)
    received.value = upload.value.received
  } catch (e) {
    const status = errorStatus(e)
    if (status && !isRetryable(status)) {
      reset()
      error.value = extractErrorMessage(e, t('auth.genericError'))
      return
    }
  }
  await send()
}

async function cancel() {
  const current = upload.value
  controller?.abort()
  reset()
  // The server forgets it on its own after a day if this does not reach it.
  if (current) await api.delete(`${BASE}/uploads/${current.id}`).catch(() => undefined)
}

function dropFailed() {
  cancel()
  error.value = ''
}

function reset() {
  phase.value = 'idle'
  pickedFile.value = null
  upload.value = null
  received.value = 0
  total.value = 0
  retrying.value = 0
}

async function showOnHomepage() {
  switching.value = true
  error.value = ''
  try {
    emit('update', await api.patch(`${BASE}/source`, { source: 'upload' }))
  } catch (e) {
    error.value = extractErrorMessage(e, t('auth.genericError'))
  } finally {
    switching.value = false
  }
}

async function remove() {
  if (!window.confirm(t('admin.serverVideo.confirmRemove'))) return
  removing.value = true
  error.value = ''
  try {
    emit('update', await api.delete(`${BASE}/upload`))
  } catch (e) {
    error.value = extractErrorMessage(e, t('auth.genericError'))
  } finally {
    removing.value = false
  }
}

// Leaving the page stops the upload; the server keeps what it has for a day,
// and picking the same file again carries on from there.
function warnBeforeUnload(event) {
  event.preventDefault()
  event.returnValue = ''
}
watch(busy, (value) => {
  if (value) window.addEventListener('beforeunload', warnBeforeUnload)
  else window.removeEventListener('beforeunload', warnBeforeUnload)
})
onBeforeRouteLeave(() => {
  if (busy.value && !window.confirm(t('admin.serverVideo.leaveConfirm'))) return false
})
onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', warnBeforeUnload)
  controller?.abort()
})
</script>

<style lang="scss" scoped>
// Laid out as the other cards of Administracija > Sadržaj (22/24 padding, 18 between).
.server-video-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 18px;
  padding: 22px 24px;
}

.server-video-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
}

.server-video-current,
.server-video-progress {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

// The size the poster preview below has, 16:9 like most exports.
.server-video-preview {
  display: block;
  width: 100%;
  max-width: 420px;
  aspect-ratio: 16 / 9;
  border-radius: $radius-card;
  background: $color-dark;
}

.server-video-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  font-size: 13px;
  font-weight: 300;
  line-height: 20px;
  color: $color-text-muted;
}

.server-video-name,
.server-video-file {
  font-weight: 500;
  color: $color-text;
  overflow-wrap: anywhere;
}

.server-video-file {
  font-size: 14px;
}

.server-video-warning {
  max-width: 640px;
  padding: 10px 14px;
  border-radius: $radius-button;
  background: $color-warning-bg;
  font-size: 13px;
  line-height: 20px;
  color: $color-warning;
}

// Administracija > Skladište's meter: 8 tall, the accent tint behind the blue.
.server-video-meter {
  width: 100%;
  max-width: 640px;
  height: 8px;
  border-radius: 4px;
  background: $color-accent-tint;
  overflow: hidden;
}

.server-video-meter span {
  display: block;
  height: 100%;
  border-radius: 4px;
  background: $color-primary;
  transition: width 0.3s ease;
}

.server-video-status {
  font-size: 14px;
  color: $color-text;
  font-variant-numeric: tabular-nums;
}

.server-video-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
}

@include mobile-only {
  .server-video-card {
    padding: 18px 16px;
  }
}
</style>
