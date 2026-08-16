<template>
  <div ref="mapEl" class="location-picker-map"></div>
</template>

<script setup>
// RNT-026 — R40 keeps geocoding automatic (the owner still just types an
// address); this only lets them drag the resulting pin to fine-tune it,
// since free-text geocoding is routinely a street or two off for Serbian
// addresses and a guest judging distance deserves better than that.
const props = defineProps({
  latitude: { type: Number, default: null },
  longitude: { type: Number, default: null },
})
const emit = defineEmits(['update:position'])

const mapEl = ref(null)
let map = null
let marker = null
let L = null

async function initMap() {
  L = (await import('leaflet')).default
  await import('leaflet/dist/leaflet.css')

  const start = hasPosition.value ? [props.latitude, props.longitude] : [44.7866, 20.4489] // Belgrade default
  map = L.map(mapEl.value, { zoomControl: true }).setView(start, hasPosition.value ? 15 : 12)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(map)

  if (hasPosition.value) placeMarker(start)

  // Geocoding can fail outright (network issue, an address it just can't
  // find) or land somewhere imprecise — either way the owner needs a way to
  // place the pin themselves, not just nudge one that's already there.
  map.on('click', (e) => {
    placeMarker(e.latlng)
    emit('update:position', { latitude: e.latlng.lat, longitude: e.latlng.lng })
  })
}

const hasPosition = computed(() => props.latitude !== null && props.longitude !== null)

function placeMarker(latlng) {
  if (marker) {
    marker.setLatLng(latlng)
    return
  }
  marker = L.marker(latlng, { draggable: true }).addTo(map)
  marker.on('dragend', () => {
    const pos = marker.getLatLng()
    emit('update:position', { latitude: pos.lat, longitude: pos.lng })
  })
}

watch(
  () => [props.latitude, props.longitude],
  ([lat, lng]) => {
    if (!map || lat === null || lng === null) return
    placeMarker([lat, lng])
    map.setView([lat, lng], 15)
  },
)

onMounted(initMap)
onBeforeUnmount(() => {
  map?.remove()
})
</script>

<style scoped>
.location-picker-map {
  width: 100%;
  height: 280px;
  border-radius: 14px;
  overflow: hidden;
}
</style>
