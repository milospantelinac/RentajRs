<template>
  <aside class="support-aside">
    <div class="support-card">
      <div class="support-row">
        <span class="support-icon"><img src="/images/icons/mail-line.svg" alt="" /></span>
        <div class="support-text">
          <p class="support-label">{{ t('contactPage.supportEmailLabel') }}</p>
          <a href="mailto:office@rentaj.rs" class="support-email">office@rentaj.rs</a>
        </div>
      </div>

      <div class="support-divider" />

      <div class="support-row">
        <span class="support-icon"><img src="/images/icons/clock-line.svg" alt="" /></span>
        <div class="support-text">
          <p class="support-label">{{ t('contactPage.responseTimeLabel') }}</p>
          <p class="support-hours">{{ t('contactPage.responseTimeValue') }}</p>
        </div>
      </div>
    </div>

    <div v-if="links.length" class="support-links">
      <p class="support-links-title">{{ t('contactPage.quickLinksTitle') }}</p>
      <NuxtLink v-for="link in links" :key="link.to" :to="link.to" class="support-link">
        {{ link.label }}
        <img src="/images/icons/arrow-right-brand-sm.svg" alt="" />
      </NuxtLink>
    </div>
  </aside>
</template>

<script setup>
// The support card and quick links of the Kontakt page (Dizajn 15, Figma
// 214:322 and 214:340), shared 1:1 with the FAQ page (Dizajn 47, 1652:11592).
// Each page passes its own links, so none of them links to itself.
defineProps({
  links: { type: Array, default: () => [] },
})

const { t } = useI18n()
</script>

<style lang="scss" scoped>
// No class here may contain "col": _grid.scss pads every [class*='col']
// element by 12px on each side.
.support-aside {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

// 214:322: Figma's stroke sits inside the frame, so its 26px padding is 25
// plus the 1px border here.
.support-card {
  display: flex;
  flex-direction: column;
  gap: 22px;
  padding: 25px;
  border: 1px solid $color-border;
  border-radius: 16px;
  background: $color-surface;
}

.support-row {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}

.support-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: $color-background;
}

.support-icon img {
  width: 20px;
  height: 20px;
}

.support-text {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  min-width: 0;
}

.support-label {
  font-size: 13px;
  line-height: normal;
  color: $color-text-muted;
}

.support-email {
  font-size: 17px;
  font-weight: 500;
  line-height: normal;
  color: $color-text;
}

.support-email:hover {
  color: $color-primary;
}

.support-hours {
  font-size: 15px;
  line-height: 22px;
  color: $color-text;
}

.support-divider {
  height: 1px;
  background: $color-border;
}

// 214:340
.support-links {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 14px;
  padding-top: 22px;
}

.support-links-title {
  font-size: 14px;
  font-weight: 500;
  line-height: normal;
  color: $color-text-muted;
}

.support-link {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  font-size: 15px;
  font-weight: 500;
  line-height: normal;
  color: $color-primary;
}

.support-link:hover {
  text-decoration: underline;
}

.support-link img {
  width: 14px;
  height: 14px;
}
</style>
