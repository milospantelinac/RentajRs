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
let resizeObserver = null
// fitBounds() below (a *result* of a search) fires the same moveend event a
// manual drag/zoom does — without this flag, emitting bounds-change from
// that event would trigger another search, whose new results would call
// fitBounds again, forever. Only a real user-driven move should emit.
let suppressNextMoveEnd = false

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

  // The map/list toggle hides this container with display:none on mobile
  // (R158), so Leaflet often initializes at zero size and never learns its
  // real dimensions afterwards — this catches every size change, including
  // the hidden-to-visible one, and makes it recompute.
  resizeObserver = new ResizeObserver(() => map?.invalidateSize())
  resizeObserver.observe(mapEl.value)

  map.on('moveend', () => {
    if (suppressNextMoveEnd) {
      suppressNextMoveEnd = false
      return
    }
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
    suppressNextMoveEnd = true
    map.fitBounds(points, { maxZoom: 14, padding: [24, 24] })
  }
}

watch(() => props.listings, renderMarkers)

onMounted(initMap)
onBeforeUnmount(() => {
  resizeObserver?.disconnect()
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
