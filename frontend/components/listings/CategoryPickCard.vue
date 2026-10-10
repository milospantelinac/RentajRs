<template>
  <!-- One category on "Šta izdajete?" (/oglasi/novi, Dizajn 17 and 50).
       T129: Administracija > Kategorije previews a category with the same
       card, so what the admin sees is what the owner will see. -->
  <component :is="tag" :type="tag === 'button' ? 'button' : undefined" class="category-card" :class="{ 'category-card-sub': sub }">
    <span
      class="category-card-icon"
      :class="{ 'category-card-icon-solid': solid }"
      aria-hidden="true"
      v-html="markup"
    />
    <span class="category-card-text">
      <span class="category-card-name">{{ category.name }}</span>
      <span v-if="category.shortDescription" class="category-card-desc">{{ category.shortDescription }}</span>
    </span>
  </component>
</template>

<script setup>
const props = defineProps({
  category: { type: Object, required: true },
  // A subcategory card, which falls back to its parent's icon.
  parent: { type: Object, default: null },
  sub: { type: Boolean, default: false },
  tag: { type: String, default: 'button' },
})

// Dizajn 50: every subcategory and Ostalo have a solid icon of their own, drawn
// at the cards' 26px; the six categories keep their 172:287 exports. A
// subcategory an admin adds later shows its parent's icon, as all of them did.
const ownKey = computed(() => categoryIconKey(props.category))
const solid = computed(() => Boolean(getCategoryIconMarkup(ownKey.value)))
const markup = computed(
  () => getCategoryIconMarkup(ownKey.value) || getWizardCategoryIconMarkup(props.parent ? categoryIconKey(props.parent) : ownKey.value),
)
</script>

<!-- Not scoped: the "Otključaj svoju kategoriju" card on /oglasi/novi builds
     on .category-card too. -->
<style lang="scss">
// 174:304: Figma's 1px stroke sits inside the 22px padding. The icon follows
// the card's colour: #CED6DE idle, blue together with the border on hover,
// which is the state 174:290 is drawn in.
.category-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 16px;
  width: 100%;
  min-width: 0;
  margin: 0;
  padding: 21px;
  border: 1px solid $color-border;
  border-radius: 16px;
  background: $color-surface;
  color: #ced6de;
  font-family: $font-family-base;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    color 0.15s ease;
}

.category-card:hover,
.category-card:focus-visible {
  border-color: $color-primary;
  color: $color-primary;
}

.category-card:focus-visible {
  outline: 2px solid rgba($color-primary, 0.35);
  outline-offset: 2px;
}

.category-card-icon {
  display: flex;
}

// Dizajn 50 (1651:3254): the solid icons are 30px components drawn at the
// cards' 26. The box sets the height; the 31-wide ones (Sobe, both vehicles)
// spill evenly past it, as they do in Figma.
.category-card-icon-solid {
  justify-content: center;
  width: 26px;
  height: 26px;
}

.category-card-icon-solid svg {
  flex-shrink: 0;
  width: auto;
  height: 100%;
}

// 1662:3280: unlike 172:287's cards, the subcategory card keeps its stroke
// outside the padding, 22 round the content and 26 below the name.
.category-card-sub {
  padding: 22px 22px 26px;
}

.category-card-text {
  display: flex;
  flex-direction: column;
  gap: 7px;
  width: 100%;
}

.category-card-name {
  font-size: 18px;
  font-weight: 500;
  line-height: normal;
  color: $color-text;
}

// A two-line box in the frame, even where the copy fits on one line.
.category-card-desc {
  min-height: 36px;
  font-size: 13px;
  line-height: 18px;
  color: $color-text-muted;
}
</style>
