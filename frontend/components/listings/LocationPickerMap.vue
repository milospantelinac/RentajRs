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
  // Dizajn 26 (277:344): "Leaflet | © OpenStreetMap contributors", without Leaflet's flag.
  map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>')
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
  // 277:336: the 40x52 brand pin, its point on the position.
  const icon = L.icon({ iconUrl: '/images/icons/map-pin-brand.svg', iconSize: [40, 52], iconAnchor: [20, 51] })
  marker = L.marker(latlng, { draggable: true, icon }).addTo(map)
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

<style lang="scss" scoped>
// Dizajn 26 (277:322): 300 tall, a 1px line inside the 12 corner, grey under the tiles.
.location-picker-map {
  width: 100%;
  height: 300px;
  border: 1px solid $color-border;
  border-radius: $radius-input;
  overflow: hidden;
  background: #f4f7f9;
  font-family: $font-family-base;
}

// 277:339: 16 from the map's outer edge, 30 by 60 with a line between + and −.
.location-picker-map :deep(.leaflet-top.leaflet-left .leaflet-control) {
  margin: 15px 0 0 15px;
}

.location-picker-map :deep(.leaflet-bar) {
  border: 1px solid $color-border;
  border-radius: 8px;
  box-shadow: none;
  overflow: hidden;
}

.location-picker-map :deep(.leaflet-bar a) {
  width: 28px;
  height: 29px;
  border: 0;
  border-radius: 0;
  background: $color-surface;
  color: $color-text;
  font: 400 15px/29px $font-family-base;
  text-indent: 0;
}

.location-picker-map :deep(.leaflet-bar a + a) {
  height: 29px;
  border-top: 1px solid $color-border;
  line-height: 28px;
}

.location-picker-map :deep(.leaflet-bar a:hover) {
  background: $color-background;
  color: $color-text;
}

.location-picker-map :deep(.leaflet-bar a.leaflet-disabled) {
  background: $color-surface;
  color: $color-text-muted;
}

// 277:344: white, 8 and 4 of padding, Light 10 in the grey text colour.
.location-picker-map :deep(.leaflet-control-attribution) {
  margin: 0;
  padding: 4px 8px;
  background: $color-surface;
  font-size: 10px;
  font-weight: 300;
  line-height: normal;
  color: $color-text-muted;
}

.location-picker-map :deep(.leaflet-control-attribution a) {
  color: inherit;
  text-decoration: none;
}
</style>
