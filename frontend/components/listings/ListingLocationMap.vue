<template>
  <div ref="mapEl" class="listing-location-map"></div>
</template>

<script setup>
// Dizajn 11 — the listing page's "Lokacija" map. Deliberately not the search
// map: there is one point, no bounds reporting, and the exact address stays
// hidden until a booking is confirmed (R33), so the pin sits inside an
// approximation circle rather than pretending to be the front door.
const props = defineProps({
  latitude: { type: [Number, String], required: true },
  longitude: { type: [Number, String], required: true },
})

const APPROXIMATION_RADIUS_M = 400

const mapEl = ref(null)
let map = null
let resizeObserver = null

onMounted(async () => {
  const L = (await import('leaflet')).default
  await import('leaflet/dist/leaflet.css')

  const point = [Number(props.latitude), Number(props.longitude)]
  map = L.map(mapEl.value, { zoomControl: false, scrollWheelZoom: false }).setView(point, 14)
  L.control.zoom({ position: 'bottomright' }).addTo(map)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(map)

  L.circle(point, {
    radius: APPROXIMATION_RADIUS_M,
    color: '#0957df',
    weight: 1,
    fillColor: '#0957df',
    fillOpacity: 0.12,
  }).addTo(map)

  L.marker(point, {
    icon: L.icon({ iconUrl: '/images/icons/map-marker.svg', iconSize: [30, 30], iconAnchor: [15, 28] }),
    keyboard: false,
  }).addTo(map)

  // The map can initialise inside a container that hasn't been laid out yet
  // (SSR hydration, a still-loading image above it); this makes it recompute.
  resizeObserver = new ResizeObserver(() => map?.invalidateSize())
  resizeObserver.observe(mapEl.value)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  map?.remove()
  map = null
})
</script>

<style lang="scss" scoped>
.listing-location-map {
  width: 100%;
  height: 300px;
  border-radius: $radius-card;
  overflow: hidden;
  background: $color-background;
}
</style>
