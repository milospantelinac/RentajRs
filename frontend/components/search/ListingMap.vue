<template>
  <div ref="mapEl" class="listing-map"></div>
</template>

<script setup>
// Leaflet + OpenStreetMap tiles — no API key needed, consistent with the
// backend's Nominatim geocoding default (see GeocodingService).
const props = defineProps({
  listings: { type: Array, default: () => [] },
})
const emit = defineEmits(['bounds-change'])

const mapEl = ref(null)
let map = null
let markersLayer = null
let L = null

async function initMap() {
  L = (await import('leaflet')).default
  await import('leaflet/dist/leaflet.css')

  map = L.map(mapEl.value, { zoomControl: true }).setView([44.7866, 20.4489], 12) // Belgrade default
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(map)

  markersLayer = L.layerGroup().addTo(map)
  renderMarkers()

  map.on('moveend', () => {
    const bounds = map.getBounds()
    emit('bounds-change', {
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest(),
    })
  })
}

function renderMarkers() {
  if (!markersLayer) return
  markersLayer.clearLayers()
  const points = []

  for (const listing of props.listings) {
    if (!listing.latitude || !listing.longitude) continue
    const marker = L.marker([listing.latitude, listing.longitude])
    marker.bindPopup(
      `<strong>${listing.title}</strong><br/>${new Intl.NumberFormat('sr-RS').format(listing.price)} RSD<br/><a href="/oglasi/${listing.slug}">Pogledaj oglas</a>`,
    )
    marker.addTo(markersLayer)
    points.push([listing.latitude, listing.longitude])
  }

  if (points.length && map) {
    map.fitBounds(points, { maxZoom: 14, padding: [24, 24] })
  }
}

watch(() => props.listings, renderMarkers)

onMounted(initMap)
onBeforeUnmount(() => {
  map?.remove()
})
</script>

<style scoped>
.listing-map {
  width: 100%;
  height: 100%;
  min-height: 400px;
  border-radius: 14px;
  overflow: hidden;
}
</style>
