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
// FAQ content is admin-editable (see /admin/sadrzaj) and fetched per the
// current locale via the x-lang header useApi() already sends.
const props = defineProps({
  limit: { type: Number, default: null },
})

const api = useApi()
const { data: faqs } = await useAsyncData('faq-list', () => api.get('/faqs'))

const items = computed(() => {
  const list = faqs.value || []
  return (props.limit ? list.slice(0, props.limit) : list).map((f, i) => ({
    index: i + 1,
    question: f.question,
    answer: f.answer,
  }))
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
