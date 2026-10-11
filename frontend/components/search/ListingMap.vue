<template>
  <div
    class="listing-map"
    :class="{ 'listing-map-loading': !mapReady, 'listing-map-has-dock': selectedListing && docked }"
    :style="dockedOffset ? { '--map-card-offset': `${dockedOffset}px` } : null"
  >
    <!-- Nothing dynamic may be bound on the element below: Leaflet writes its
         own classes on its container, and Vue's class patch would wipe them. -->
    <div ref="mapEl" class="listing-map-canvas"></div>

    <!-- Dizajn 44: the tiles are the last thing on this page to arrive, a
         dynamic import and then a network round trip after the cards, so the
         frame holds the same grey block until the first tileset is painted. -->
    <SkeletonBox v-if="!mapReady" class="listing-map-skeleton" height="100%" radius="14px" />

    <!-- T113: the small card of the pill that was clicked, above it (or under
         it near the top of the map) on a desktop, along the bottom on a phone. -->
    <div
      v-if="selectedListing"
      ref="cardWrap"
      class="listing-map-card"
      :class="`listing-map-card-${cardPlacement}`"
      :style="cardStyle"
    >
      <MapListingCard
        :listing="selectedListing"
        :index="selectedIndex"
        :count="selectedGroup.listings.length"
        :placement="cardPlacement"
        :arrow-x="cardArrowX"
        @close="closeCard"
        @step="stepCard"
      />
    </div>
  </div>
</template>

<script setup>
// Leaflet + OpenStreetMap tiles — no API key needed, consistent with the
// backend's Nominatim geocoding default (see GeocodingService).
const props = defineProps({
  listings: { type: Array, default: () => [] },
})
// T113: card-change tells the page where the docked card ends, so "Uvećaj
// mapu" can sit above it on a phone.
const emit = defineEmits(['bounds-change', 'ready', 'card-change'])
const { t } = useI18n()

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
// T113 (Tamara, 2026-10-10): a phone shows the list first and keeps the map
// hidden, and a hidden map has no size: Leaflet then fits the pins into
// nothing and lands on their middle at the closest zoom, often with no pin in
// sight. The fit waits until the map is shown. A map nobody has moved since
// its last fit fits its pins again whenever its size changes ("Uvećaj mapu", a
// turned phone, a resized window); a resize is never taken for the user's move
// (it used to bring up "Pretraži ovo područje" the moment the map was opened).
let fitPending = false
let movedByUser = false
let ignoreMoves = false

// -- T113: one pill per point, the card of the clicked one ------------------

// Figma 1716:3290: a 300px card 13px above its pill (the 8px caret laps 1px
// over the card, then 6px of air), its close button 10px out of the top
// right corner; the card, button included, keeps 8px from the map's edges.
// A phone docks it 16px from the bottom and the sides (1716:3356).
const CARD_WIDTH = 300
const CARD_GAP = 13
const CARD_CLOSE_OUT = 10
const CARD_EDGE = 8
// The caret stays on the card's straight edge, clear of its 16px corners.
const CARET_MIN = 24
const DOCK_EDGE = 16
const PHONE_QUERY = '(max-width: 767.98px)'

const markersByKey = new Map()
const selectedKey = ref('')
const selectedIndex = ref(0)
const cardWrap = ref(null)
const cardPlacement = ref('above')
const cardStyle = ref({})
const cardArrowX = ref(CARD_WIDTH / 2)
const docked = ref(false)
const dockedOffset = ref(0)
let phoneQuery = null

// Listings that share a point (two flats in one building, or addresses
// geocoded to the same spot) are one pill: its lowest price and "+N", and the
// card steps through them, cheapest first (T113 point 8, agreed 2026-10-09).
const groups = computed(() => {
  const byPoint = new Map()
  for (const listing of props.listings) {
    if (!listing.latitude || !listing.longitude) continue
    const lat = Number(listing.latitude)
    const lng = Number(listing.longitude)
    const key = `${lat.toFixed(5)},${lng.toFixed(5)}`
    if (!byPoint.has(key)) byPoint.set(key, { key, lat, lng, listings: [] })
    byPoint.get(key).listings.push(listing)
  }
  for (const group of byPoint.values()) {
    // One with no slot ahead has no price to show and goes last.
    const rank = (listing) =>
      formatListingPrice(listing, t) ? Number(listing.price) || 0 : Infinity
    group.listings.sort((a, b) => rank(a) - rank(b))
  }
  return [...byPoint.values()]
})

const selectedGroup = computed(
  () => groups.value.find((group) => group.key === selectedKey.value) || null,
)
const selectedListing = computed(() => selectedGroup.value?.listings[selectedIndex.value] || null)

function pinHtml(group) {
  // T121: "Od 12.000 RSD" on defined slots, "Bez termina" with none ahead.
  const price = formatListingPrice(group.listings[0], t) || t('listing.mapNoUpcomingSlots')
  const more =
    group.listings.length > 1
      ? `<span class="listing-map-pin-more">+${group.listings.length - 1}</span>`
      : ''
  return `<span class="listing-map-pin">${escapeHtml(price)}${more}</span>`
}

function setPinActive(key, active) {
  const marker = markersByKey.get(key)
  if (!marker) return
  marker.getElement()?.classList.toggle('listing-map-pin-active', active)
  marker.setZIndexOffset(active ? 1000 : 0)
}

function selectGroup(key) {
  if (selectedKey.value && selectedKey.value !== key) setPinActive(selectedKey.value, false)
  if (selectedKey.value !== key) selectedIndex.value = 0
  selectedKey.value = key
  setPinActive(key, true)
  placeCard()
}

function closeCard() {
  if (!selectedKey.value) return
  setPinActive(selectedKey.value, false)
  selectedKey.value = ''
  selectedIndex.value = 0
}

function stepCard(direction) {
  const count = selectedGroup.value?.listings.length || 0
  if (count < 2) return
  selectedIndex.value = (selectedIndex.value + direction + count) % count
  placeCard()
}

// Above the pill, centred on it and kept inside the map; under it when the
// pill is too near the top for the card to fit above. The caret keeps
// pointing at the pill when the card is pushed in from an edge.
async function placeCard() {
  docked.value = Boolean(phoneQuery?.matches)
  await nextTick()
  const group = selectedGroup.value
  const card = cardWrap.value
  if (!map || !group || !card) return
  if (docked.value) {
    cardPlacement.value = 'docked'
    cardStyle.value = { left: `${DOCK_EDGE}px`, right: `${DOCK_EDGE}px`, bottom: `${DOCK_EDGE}px` }
    await nextTick()
    dockedOffset.value = DOCK_EDGE + card.offsetHeight
    return
  }
  dockedOffset.value = 0
  const size = map.getSize()
  const point = map.latLngToContainerPoint([group.lat, group.lng])
  const pin = markersByKey.get(group.key)?.getElement()?.querySelector('.listing-map-pin')
  const pinHalf = pin ? pin.offsetHeight / 2 : 15
  const height = card.offsetHeight
  const above = point.y - pinHalf - CARD_GAP - height
  cardPlacement.value = above - CARD_CLOSE_OUT >= CARD_EDGE ? 'above' : 'below'
  const left = Math.min(
    Math.max(point.x - CARD_WIDTH / 2, CARD_EDGE),
    size.x - CARD_WIDTH - CARD_CLOSE_OUT - CARD_EDGE,
  )
  cardArrowX.value = Math.min(Math.max(point.x - left, CARET_MIN), CARD_WIDTH - CARET_MIN)
  cardStyle.value = {
    left: `${left}px`,
    top: `${cardPlacement.value === 'above' ? above : point.y + pinHalf + CARD_GAP}px`,
    width: `${CARD_WIDTH}px`,
  }
}

watch(dockedOffset, (offset) => emit('card-change', { docked: docked.value && offset > 0, offset }))
watch(selectedKey, (key) => {
  if (!key) dockedOffset.value = 0
})

function onKeydown(event) {
  if (event.key === 'Escape') closeCard()
}

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
  // T113: the ResizeObserver below follows every size change, the window's
  // too, so Leaflet's own resize handling (a moveend 200ms later, read as the
  // user's move) stays off.
  map = L.map(mapEl.value, { zoomControl: false, trackResize: false }).setView([44.7866, 20.4489], 12) // Belgrade default
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
  // the hidden-to-visible one, and makes it recompute. T113: then the pins
  // that came while it was hidden are fitted, and an unmoved map refits.
  resizeObserver = new ResizeObserver(() => {
    if (!map) return
    ignoreMoves = true
    map.invalidateSize()
    ignoreMoves = false
    if (hasSize() && (fitPending || !movedByUser)) fitPins({ animate: false })
    startReadyFallback()
    if (selectedKey.value) placeCard()
  })
  resizeObserver.observe(mapEl.value)

  // T113: a click on the map itself closes the card; the pills and the card
  // keep their clicks to themselves. The card follows its pill as the map moves.
  map.on('click', closeCard)
  map.on('move zoomend', () => {
    if (selectedKey.value && !docked.value) placeCard()
  })

  map.on('moveend', () => {
    if (ignoreMoves) return
    if (suppressNextMoveEnd) {
      suppressNextMoveEnd = false
      return
    }
    movedByUser = true
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
  markersByKey.clear()

  for (const group of groups.value) {
    // Dizajn 8 — the map shows the price itself rather than a generic pin, so
    // the marker is a styled label (divIcon) instead of Leaflet's image pin.
    const marker = L.marker([group.lat, group.lng], {
      icon: L.divIcon({ className: 'listing-map-pin-wrap', html: pinHtml(group), iconSize: null }),
      keyboard: true,
    })
    marker.on('click', () => selectGroup(group.key))
    marker.addTo(markersLayer)
    markersByKey.set(group.key, marker)
  }

  // A new search keeps the card while its listing is still among the results.
  if (selectedKey.value) {
    const group = selectedGroup.value
    if (!group) closeCard()
    else {
      if (selectedIndex.value >= group.listings.length) selectedIndex.value = 0
      setPinActive(group.key, true)
    }
  }

  if (groups.value.length) fitPins()
  else fitPending = false
  if (selectedKey.value) placeCard()
}

function hasSize() {
  return Boolean(mapEl.value?.clientWidth && mapEl.value?.clientHeight)
}

// Every pin in view, once the map has a size to fit them into (T113). The fit
// after a search animates as before; one on showing or resizing the map is
// immediate, and its moves are the map's own.
function fitPins({ animate } = {}) {
  const points = groups.value.map((group) => [group.lat, group.lng])
  if (!map || !points.length) return
  if (!hasSize()) {
    fitPending = true
    return
  }
  fitPending = false
  movedByUser = false
  if (animate === false) {
    ignoreMoves = true
    map.fitBounds(points, { maxZoom: 14, padding: [24, 24], animate: false })
    ignoreMoves = false
    return
  }
  suppressNextMoveEnd = true
  map.fitBounds(points, { maxZoom: 14, padding: [24, 24] })
}

watch(() => props.listings, renderMarkers)

function onPhoneChange() {
  if (selectedKey.value) placeCard()
}

onMounted(() => {
  phoneQuery = window.matchMedia(PHONE_QUERY)
  phoneQuery.addEventListener('change', onPhoneChange)
  window.addEventListener('keydown', onKeydown)
  initMap()
})
onBeforeUnmount(() => {
  clearTimeout(readyTimer)
  resizeObserver?.disconnect()
  phoneQuery?.removeEventListener('change', onPhoneChange)
  window.removeEventListener('keydown', onKeydown)
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

// T113: above Leaflet's panes and controls (up to 1000).
.listing-map-card {
  position: absolute;
  z-index: 1001;
}

// On a phone the docked card covers the bottom; Leaflet's zoom moves above it.
.listing-map-has-dock :deep(.leaflet-bottom) {
  bottom: var(--map-card-offset, 0);
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
  display: inline-flex;
  align-items: center;
  gap: 6px;
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
  cursor: pointer;
}

.listing-map :deep(.listing-map-pin-more) {
  font-weight: 400;
  color: $color-text-muted;
}

// T113: a hovered pill and the one whose card is open are blue.
.listing-map :deep(.leaflet-marker-icon:hover .listing-map-pin),
.listing-map :deep(.listing-map-pin-active .listing-map-pin) {
  background: $color-primary;
  border-color: $color-primary;
  color: $color-surface;
}

.listing-map :deep(.leaflet-marker-icon:hover .listing-map-pin-more),
.listing-map :deep(.listing-map-pin-active .listing-map-pin-more) {
  color: $color-surface;
}
</style>
