<template>
  <div class="listing-map" :class="{ 'listing-map-loading': !mapReady }">
    <!-- Nothing dynamic may be bound on the element below: Leaflet writes its
         own classes on its container, and Vue's class patch would wipe them. -->
    <div ref="mapEl" class="listing-map-canvas"></div>

    <!-- Dizajn 44: the tiles are the last thing on this page to arrive, a
         dynamic import and then a network round trip after the cards, so the
         frame holds the same grey block until the first tileset is painted. -->
    <SkeletonBox v-if="!mapReady" class="listing-map-skeleton" height="100%" radius="14px" />
  </div>
</template>

<script setup>
// Leaflet + OpenStreetMap tiles — no API key needed, consistent with the
// backend's Nominatim geocoding default (see GeocodingService).
const props = defineProps({
  listings: { type: Array, default: () => [] },
})
const emit = defineEmits(['bounds-change', 'ready'])

const mapEl = ref(null)
// Dizajn 44: the frame is a skeleton until the first tileset is on screen,
// and the page keeps the controls that sit over the map hidden until then.
const mapReady = ref(false)
const READY_FALLBACK_MS = 6000
let readyTimer = null
let map = null
let markersLayer = null
let L = null
let resizeObserver = null
// fitBounds() below (a *result* of a search) fires the same moveend event a
// manual drag/zoom does — without this flag, emitting bounds-change from
// that event would trigger another search, whose new results would call
// fitBounds again, forever. Only a real user-driven move should emit.
let suppressNextMoveEnd = false

function markReady() {
  if (mapReady.value) return
  mapReady.value = true
  clearTimeout(readyTimer)
  readyTimer = null
  emit('ready')
}

// Leaflet asks for no tiles while the container is hidden (the mobile
// map/list toggle sets display:none), so neither 'load' nor 'tileerror' can
// fire there: this safety net only starts once the frame has a size to draw
// into, and it also covers an import or a map that never arrives at all.
function startReadyFallback() {
  if (mapReady.value || readyTimer || !mapEl.value?.clientHeight) return
  readyTimer = setTimeout(markReady, READY_FALLBACK_MS)
}

async function initMap() {
  startReadyFallback()
  L = (await import('leaflet')).default
  await import('leaflet/dist/leaflet.css')

  // Zoom sits bottom-left: Dizajn 8 puts the "search as I move" control in
  // the map's top-left corner, where Leaflet's default zoom would cover it.
  map = L.map(mapEl.value, { zoomControl: false }).setView([44.7866, 20.4489], 12) // Belgrade default
  L.control.zoom({ position: 'bottomleft' }).addTo(map)
  const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  })
  // 'load' is the whole visible tileset, which is the first moment the frame
  // really shows a map; a tile that never arrives (offline, blocked host)
  // reveals Leaflet's own background rather than leaving grey pulsing on.
  tiles.on('load', markReady)
  tiles.on('tileerror', markReady)
  tiles.addTo(map)

  markersLayer = L.layerGroup().addTo(map)
  renderMarkers()

  // The map/list toggle hides this container with display:none on mobile
  // (R158), so Leaflet often initializes at zero size and never learns its
  // real dimensions afterwards — this catches every size change, including
  // the hidden-to-visible one, and makes it recompute.
  resizeObserver = new ResizeObserver(() => {
    map?.invalidateSize()
    startReadyFallback()
  })
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

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

function renderMarkers() {
  if (!markersLayer) return
  markersLayer.clearLayers()
  const points = []

  for (const listing of props.listings) {
    if (!listing.latitude || !listing.longitude) continue
    const price = new Intl.NumberFormat('sr-RS').format(listing.price)
    // Dizajn 8 — the map shows the price itself rather than a generic pin, so
    // the marker is a styled label (divIcon) instead of Leaflet's image pin.
    const marker = L.marker([listing.latitude, listing.longitude], {
      icon: L.divIcon({
        className: 'listing-map-pin-wrap',
        html: `<span class="listing-map-pin">${escapeHtml(price)} RSD</span>`,
        iconSize: null,
      }),
    })
    marker.bindPopup(
      `<strong>${escapeHtml(listing.title)}</strong><br/>${price} RSD<br/><a href="/oglasi/${escapeHtml(listing.slug)}">Pogledaj oglas</a>`,
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
  clearTimeout(readyTimer)
  resizeObserver?.disconnect()
  map?.remove()
})
</script>

<style lang="scss" scoped>
.listing-map {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 400px;
  border-radius: 14px;
  overflow: hidden;
}

.listing-map-canvas {
  position: absolute;
  inset: 0;
}

// Leaflet's own zoom control, attribution and price pins carry z-indexes of
// their own (up to 1000) and would paint through the skeleton, so the map
// hides rather than stacks. visibility keeps the box measurable, which is
// what Leaflet sizes its tile grid from.
.listing-map-loading .listing-map-canvas {
  visibility: hidden;
}

.listing-map-skeleton {
  position: absolute;
  top: 0;
  left: 0;
}

// Figma 624:532 — the price label sits on the point, so the wrapper is
// unstyled and the label centres itself over the coordinate. Not scoped with
// :deep alone because Leaflet builds these nodes outside the component tree.
.listing-map :deep(.listing-map-pin-wrap) {
  width: auto !important;
  height: auto !important;
  margin: 0 !important;
  background: none;
  border: none;
}

.listing-map :deep(.listing-map-pin) {
  display: inline-block;
  transform: translate(-50%, -50%);
  padding: 7px 12px;
  border: 1px solid $color-border;
  border-radius: $radius-pill;
  background: $color-surface;
  color: $color-text;
  font-family: $font-family-base;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.2;
  white-space: nowrap;
  box-shadow: 0 2px 6px rgba(6, 27, 49, 0.12);
}

.listing-map :deep(.leaflet-marker-icon:hover .listing-map-pin) {
  background: $color-primary;
  border-color: $color-primary;
  color: $color-surface;
}
</style>
