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
        <span class="faq-icon" aria-hidden="true">
          <img
            v-if="openIndex === item.index"
            src="/images/icons/faq-minus.svg"
            alt=""
            class="faq-icon-minus"
          />
          <img v-else src="/images/icons/faq-plus.svg" alt="" class="faq-icon-plus" />
        </span>
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
// Figma (nodes 26:1075–26:1103): 728-wide panels on #F9FAFD, radius 15, 73px
// collapsed, 16px apart; question 20px Medium at 32px from the panel edge;
// the toggle is a 48px white radius-8 square 12px in from the right.
.faq-accordion {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.faq-item {
  border-radius: 15px;
  background: $color-background;
  overflow: hidden;
}

.faq-question {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 73px;
  padding: 12px 12px 12px 32px;
  background: none;
  border: none;
  text-align: left;
  font-family: $font-family-base;
  font-size: 20px;
  font-weight: 500;
  line-height: 1.5;
  color: $color-text;
  cursor: pointer;
}

.faq-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  border-radius: 8px;
  background: $color-surface;
}

// The plus asset is the full 48px tile; the minus is only the 16x3 bar, so
// the wrapper above supplies its white tile.
.faq-icon-plus {
  display: block;
  width: 48px;
  height: 48px;
}

.faq-icon-minus {
  display: block;
  width: 16px;
  height: 3px;
}

.faq-answer {
  padding: 10px 32px 31px;
}

.faq-answer p {
  margin: 0;
  color: $color-text-muted;
  font-size: 18px;
  line-height: 1.5;
}

// Dizajn 42 (94:27, 26:3271 - 26:3296): on a phone the panels are 50 tall,
// radius 10 and 10 apart; the question is 16 Medium 17 from the left and the
// toggle is the same white tile at 37, 7 in from the right. The frame drops
// every question about 50px below its own panel; the answer here follows the
// question row, 14/1.5 in the frame's 282 column.
@include respond-below(md) {
  .faq-accordion {
    gap: 10px;
  }

  .faq-item {
    border-radius: 10px;
  }

  .faq-question {
    min-height: 50px;
    padding: 6.5px 7px 6.5px 17px;
    font-size: 16px;
  }

  .faq-icon {
    width: 37px;
    height: 37px;
    border-radius: 6.17px;
  }

  .faq-icon-plus {
    width: 37px;
    height: 37px;
  }

  .faq-icon-minus {
    width: 13.1px;
    height: 2.22px;
  }

  .faq-answer {
    padding: 0 17px 17px;
  }

  .faq-answer p {
    max-width: 282px;
    font-size: 14px;
  }
}
</style>
