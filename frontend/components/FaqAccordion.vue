<template>
  <div class="faq-accordion">
    <div v-for="item in items" :key="item.index" class="faq-item">
      <button
        class="faq-question"
        :class="{ 'faq-question-open': openIndex === item.index }"
        :aria-expanded="openIndex === item.index"
        @click="toggle(item.index)"
      >
        <span>{{ item.question }}</span>
        <span class="faq-icon" aria-hidden="true">{{ openIndex === item.index ? '−' : '+' }}</span>
      </button>
      <div v-show="openIndex === item.index" class="faq-answer">
        <p>{{ item.answer }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
// The FAQ content is a fixed, hand-translated set (faq.q1..q6 / a1..a6 in
// both locales) rather than a dynamic list — see locales/{sr,en}.json.
const FAQ_COUNT = 6

const props = defineProps({
  limit: { type: Number, default: null },
})

const { t } = useI18n()

const items = computed(() => {
  const count = props.limit ? Math.min(props.limit, FAQ_COUNT) : FAQ_COUNT
  return Array.from({ length: count }, (_, i) => {
    const index = i + 1
    return { index, question: t(`faq.q${index}`), answer: t(`faq.a${index}`) }
  })
})

const openIndex = ref(1)
function toggle(index) {
  openIndex.value = openIndex.value === index ? null : index
}
</script>

<style lang="scss" scoped>
.faq-accordion {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.faq-item {
  border: 1px solid $color-border;
  border-radius: $radius-card;
  background: $color-surface;
  overflow: hidden;
}

.faq-question {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
  background: none;
  border: none;
  text-align: left;
  font-family: $font-family-base;
  font-size: $font-size-body;
  font-weight: 600;
  color: $color-text;
  cursor: pointer;
  min-height: $touch-target-min;
}

.faq-question-open {
  color: $color-primary;
}

.faq-icon {
  flex-shrink: 0;
  font-size: 18px;
  line-height: 1;
  color: $color-primary;
}

.faq-answer {
  padding: 0 20px 18px;
}

.faq-answer p {
  margin: 0;
  color: $color-text-muted;
  font-size: $font-size-body;
  line-height: 1.7;
}
</style>
