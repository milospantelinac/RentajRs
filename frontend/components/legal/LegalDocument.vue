<template>
  <div class="legal-page">
    <div class="container">
      <header class="legal-hero">
        <h1 class="legal-title">
          {{ titleLead }} <span v-if="titleMuted" class="legal-title-muted">{{ titleMuted }}</span>
        </h1>
        <p v-if="subtitle" class="legal-subtitle">{{ subtitle }}</p>
        <p v-if="updated" class="legal-updated">
          <img src="/images/icons/dot-brand-6.svg" alt="" />
          {{ t('legalPages.lastUpdated', { date: updated }) }}
        </p>
      </header>

      <div class="legal-split">
        <div class="legal-aside">
          <div class="legal-aside-inner">
            <nav v-if="doc.sections.length" ref="tocRef" class="legal-toc" :aria-label="t('legalPages.toc')">
              <p class="legal-toc-title" aria-hidden="true">{{ t('legalPages.toc') }}</p>
              <a
                v-for="section in doc.sections"
                :key="section.id"
                :href="`#${section.id}`"
                class="legal-toc-item"
                :class="{ 'is-active': section.id === activeId }"
                :aria-current="section.id === activeId ? 'location' : undefined"
                @click="goTo($event, section.id)"
              >
                <span v-if="section.num" class="legal-toc-num">{{ section.num }}</span>
                <span class="legal-toc-label">{{ section.label }}</span>
              </a>
            </nav>
            <SupportAside class="legal-support" />
          </div>
        </div>

        <!-- Admin-edited HTML (StaticPage.bodyHtml), with ids and numeral
             badges added to its h2s by buildLegalDocument. -->
        <article ref="bodyRef" class="legal-body" v-html="doc.html" />
      </div>
    </div>
  </div>
</template>

<script setup>
// Dizajn 48 (Figma "Politika privatnosti · Desktop 1440", node 1652:3356), the
// layout both legal pages share: hero, a sticky "Sadrzaj" list of the page's
// h2 sections next to the text, the Kontakt support card under it. The
// list's anchors scroll smoothly and the item of the section on screen is
// marked; below lg it is one column, the list above the text, not sticky.
const props = defineProps({
  // StaticPage row: { title, bodyHtml, updatedAt }
  page: { type: Object, required: true },
  subtitle: { type: String, default: '' },
})

const { t } = useI18n()

const doc = computed(() => buildLegalDocument(props.page.bodyHtml))

// The frame mutes the title's last word ("Politika privatnosti").
const titleParts = computed(() => {
  const title = (props.page.title || '').trim()
  const cut = title.lastIndexOf(' ')
  return cut > 0 ? [title.slice(0, cut), title.slice(cut + 1)] : [title, '']
})
const titleLead = computed(() => titleParts.value[0])
const titleMuted = computed(() => titleParts.value[1])

const updated = computed(() =>
  props.page.updatedAt
    ? new Date(props.page.updatedAt).toLocaleDateString('sr-RS', { timeZone: 'Europe/Belgrade' })
    : '',
)

const bodyRef = ref(null)
const tocRef = ref(null)
const activeId = ref(doc.value.sections[0]?.id || '')

// A section is the current one once its heading has scrolled up to the line
// its anchor jump stops at (the heading's scroll-margin-top, under the
// sticky header). At the very bottom the last sections can no longer reach
// that line, so the last one wins there.
function updateActive() {
  frame = 0
  const headings = bodyRef.value?.querySelectorAll('h2[id]')
  if (!headings?.length) return
  const line = parseFloat(getComputedStyle(headings[0]).scrollMarginTop || '0') + 12
  let current = headings[0].id
  for (const heading of headings) {
    if (heading.getBoundingClientRect().top > line) break
    current = heading.id
  }
  const root = document.documentElement
  if (window.innerHeight + window.scrollY >= root.scrollHeight - 2) current = headings[headings.length - 1].id
  activeId.value = current
}

let frame = 0
function onScroll() {
  if (!frame) frame = requestAnimationFrame(updateActive)
}

function goTo(event, id) {
  const target = document.getElementById(id)
  if (!target) return
  event.preventDefault()
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  activeId.value = id
}

// On a short window the list scrolls inside its card; keep the marked item
// in view there without moving the page.
watch(
  activeId,
  () => {
    const toc = tocRef.value
    const item = toc?.querySelector('.legal-toc-item.is-active')
    if (!toc || !item || toc.scrollHeight <= toc.clientHeight) return
    const box = toc.getBoundingClientRect()
    const itemBox = item.getBoundingClientRect()
    if (itemBox.top < box.top) toc.scrollTop -= box.top - itemBox.top + 8
    else if (itemBox.bottom > box.bottom) toc.scrollTop += itemBox.bottom - box.bottom + 8
  },
  { flush: 'post' },
)

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onScroll, { passive: true })
  updateActive()
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', onScroll)
  if (frame) cancelAnimationFrame(frame)
})
</script>

<style lang="scss" scoped>
// Every value here is read off frame 1652:3356. No class here may contain
// "col": _grid.scss pads every [class*='col'] element by 12px on each side.

// 1652:3386: 72 under the header, 120 above the footer.
.legal-page {
  padding: 72px 0 120px;
}

// 1654:3270
.legal-hero {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 16px;
  padding-bottom: 56px;
}

.legal-title {
  font-size: 52px;
  font-weight: 400;
  line-height: 58px;
  letter-spacing: -1.82px;
  color: $color-text;
}

.legal-title-muted {
  color: $color-text-muted;
}

.legal-subtitle {
  font-size: 18px;
  line-height: 28px;
  color: $color-text-muted;
}

// 1654:3273
.legal-updated {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px 8px 12px;
  border: 1px solid $color-border;
  border-radius: 999px;
  background: $color-background;
  font-size: 13px;
  font-weight: 500;
  line-height: normal;
  color: $color-text-muted;
}

.legal-updated img {
  display: block;
  width: 6px;
  height: 6px;
}

// 1654:3276: 320 | 112 | 720.
.legal-split {
  display: grid;
  grid-template-columns: 320px minmax(0, 720px);
  column-gap: 112px;
}

// The list and the card stay in view together while the text scrolls, 24
// under the sticky header; on a short window the list scrolls inside its
// card so the card under it never falls off the bottom.
.legal-aside-inner {
  position: sticky;
  top: 128px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-height: calc(100vh - 152px);
}

// 1654:3440: the stroke sits outside the padding here, so the items start 25
// in; title to the first item is 16 (4 + 8 + 4 in the frame).
.legal-toc {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-height: 0;
  padding: 24px 24px 20px;
  overflow-y: auto;
  border: 1px solid $color-border;
  border-radius: 16px;
  background: $color-surface;
}

.legal-toc-title {
  margin-bottom: 12px;
  font-size: 11px;
  font-weight: 500;
  line-height: normal;
  letter-spacing: 0.66px;
  text-transform: uppercase;
  color: $color-primary;
}

// 1654:3443 (active) and 1654:3446
.legal-toc-item {
  display: flex;
  flex: none;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 8px 8px 12px;
  border-radius: 8px;
  font-size: 13px;
  line-height: 20px;
  color: $color-text-muted;
}

.legal-toc-item:hover,
.legal-toc-item.is-active {
  background: $color-background;
}

.legal-toc-item:focus-visible {
  outline: 2px solid rgba($color-primary, 0.35);
  outline-offset: 2px;
}

.legal-toc-num {
  flex: none;
  width: 26px;
  font-weight: 600;
}

.legal-toc-label {
  flex: 1;
  min-width: 0;
}

.legal-toc-item.is-active .legal-toc-num {
  color: $color-primary;
}

.legal-toc-item.is-active .legal-toc-label {
  font-weight: 500;
  color: $color-text;
}

.legal-support {
  flex: none;
}

// 1654:3278: the text column. The body is admin-edited HTML, so it is styled
// by element; the last section keeps 40 under it as in the frame.
.legal-body {
  min-width: 0;
  padding-bottom: 40px;
  font-size: 17px;
  line-height: 30px;
  color: $color-text-muted;
}

// 1654:3280: a 40 badge and the heading 16 apart; from the second section on
// a rule with 40 above and 40 below.
.legal-body :deep(h2) {
  display: flex;
  align-items: center;
  gap: 16px;
  margin: 40px 0 0;
  padding-top: 40px;
  border-top: 1px solid $color-border;
  font-size: 22px;
  font-weight: 600;
  line-height: 30px;
  letter-spacing: 0.2px;
  color: $color-text;
  scroll-margin-top: 128px;
}

.legal-body :deep(h2:first-child) {
  margin-top: 0;
  padding-top: 0;
  border-top: 0;
}

.legal-body :deep(.legal-h2-num) {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: $color-accent-tint;
  font-size: 15px;
  font-weight: 600;
  line-height: normal;
  letter-spacing: normal;
  color: $color-primary;
}

.legal-body :deep(.legal-h2-text) {
  flex: 1;
  min-width: 0;
}

// 1654:3303
.legal-body :deep(h3) {
  margin: 32px 0 0;
  font-size: 18px;
  font-weight: 500;
  line-height: 26px;
  color: $color-text;
}

.legal-body :deep(p) {
  margin: 0;
}

.legal-body :deep(a) {
  font-weight: 500;
  color: $color-primary;
}

.legal-body :deep(a:hover) {
  text-decoration: underline;
}

// 1654:3294 and 1654:3305: items 12 apart, the marker 14 before the text.
.legal-body :deep(ul),
.legal-body :deep(ol) {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 12px 0 0;
  padding: 0;
  list-style: none;
}

.legal-body :deep(li) {
  position: relative;
  padding-left: 20px;
}

.legal-body :deep(ul > li)::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 6px;
  height: 18px;
  background: url('/images/icons/legal-bullet.svg') no-repeat;
}

.legal-body :deep(ol) {
  counter-reset: legal-item;
}

.legal-body :deep(ol > li) {
  padding-left: 34px;
  counter-increment: legal-item;
}

.legal-body :deep(ol > li)::before {
  content: counter(legal-item) '.';
  position: absolute;
  top: 3px;
  left: 0;
  width: 20px;
  font-size: 15px;
  font-weight: 600;
  line-height: 24px;
  color: $color-primary;
}

// The editor wraps a list item's text in a paragraph.
.legal-body :deep(li > p) {
  margin: 0;
}

// Rhythm inside a section: paragraph to paragraph 18, a lead-in line to its
// list 12, a list to the next paragraph 20; these come last so they win over
// the list margin above.
.legal-body :deep(p + p) {
  margin-top: 18px;
}

.legal-body :deep(ul + p),
.legal-body :deep(ol + p) {
  margin-top: 20px;
}

.legal-body :deep(h2 + *) {
  margin-top: 16px;
}

.legal-body :deep(h3 + *) {
  margin-top: 12px;
}

@include respond-between(lg, xl) {
  .legal-split {
    column-gap: 48px;
  }
}

// No frame below 1440: one column with the list above the text, not sticky,
// and the support card after the text as on the FAQ page.
@include respond-below(lg) {
  .legal-split {
    display: flex;
    flex-direction: column;
    gap: 32px;
  }

  .legal-aside,
  .legal-aside-inner {
    display: contents;
  }

  .legal-toc {
    flex: none;
    order: 1;
    overflow: visible;
  }

  .legal-body {
    order: 2;
    padding-bottom: 8px;
  }

  .legal-support {
    order: 3;
    max-width: 400px;
  }
}

// Phone: Kontakt's title and page padding.
@include respond-below(md) {
  .legal-page {
    padding: 40px 0 56px;
  }

  .legal-hero {
    padding-bottom: 32px;
  }

  .legal-title {
    font-size: 34px;
    line-height: 42px;
    letter-spacing: -1.19px;
  }

  .legal-subtitle {
    font-size: 16px;
    line-height: 26px;
  }

  .legal-body :deep(h2) {
    scroll-margin-top: 93px;
  }

  .legal-support {
    max-width: none;
  }
}
</style>
