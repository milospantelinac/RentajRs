<template>
  <section class="guestreview" :aria-labelledby="titleId">
    <!-- 568:673: the form, also for changing a review while its window lasts. -->
    <template v-if="showForm">
      <h2 :id="titleId" class="guestreview-title">{{ editing ? t('reviews.yourReview') : t('reviews.leaveReview') }}</h2>

      <p :id="ratingLabelId" class="guestreview-label">{{ t('reviews.rating') }}</p>
      <div class="guestreview-stars" role="radiogroup" :aria-labelledby="ratingLabelId" @mouseleave="hovered = 0">
        <button
          v-for="n in 5"
          :key="n"
          type="button"
          role="radio"
          class="guestreview-star"
          :aria-checked="form.rating === n ? 'true' : 'false'"
          :aria-label="t('reviews.starLabel', { count: n })"
          :tabindex="n === (form.rating || 1) ? 0 : -1"
          @click="form.rating = n"
          @mouseenter="hovered = n"
          @keydown="onStarKey($event, n)"
        >
          <img :src="n <= (hovered || form.rating) ? '/images/icons/star-full-22.svg' : '/images/icons/star-empty-26.svg'" alt="" width="26" height="26" />
        </button>
      </div>

      <label :for="commentId" class="guestreview-label">{{ t('reviews.comment') }}</label>
      <textarea
        :id="commentId"
        v-model="form.comment"
        class="guestreview-textarea"
        :placeholder="t('reviews.commentPlaceholder')"
        maxlength="2000"
      ></textarea>

      <p v-if="error" class="guestreview-error" role="alert">{{ error }}</p>

      <div class="guestreview-buttons">
        <button type="button" class="guestreview-submit" :disabled="!form.rating || saving" @click="save">
          {{ editing ? t('reviews.saveEdit') : t('reviews.submit') }}
        </button>
        <button v-if="editing" type="button" class="guestreview-link" :disabled="saving" @click="stopEditing">{{ t('reviews.cancelEdit') }}</button>
      </div>

      <p class="guestreview-note is-info">
        <img src="/images/icons/info-circle.svg" alt="" width="16" height="16" class="guestreview-note-icon" />
        <span>{{ editing ? t('reviews.editNote', { date: editableUntilText }) : t('reviews.formNote') }}</span>
      </p>
    </template>

    <!-- 568:857: the review as posted, public at once (585:515). -->
    <template v-else-if="mine">
      <h2 :id="titleId" class="guestreview-title">{{ t('reviews.yourReview') }}</h2>
      <p class="guestreview-rating" role="img" :aria-label="t('reviews.starLabel', { count: mine.rating })">
        <img
          v-for="n in 5"
          :key="n"
          :src="n <= mine.rating ? '/images/icons/star-full-22.svg' : '/images/icons/star-empty-22.svg'"
          alt=""
          width="22"
          height="22"
        />
      </p>
      <p v-if="mine.comment" class="guestreview-comment">{{ mine.comment }}</p>
      <p class="guestreview-note is-success" role="status">
        {{ mine.editable ? t('reviews.publishedEditableNote', { date: editableUntilText }) : t('reviews.publishedNote') }}
      </p>
      <button v-if="mine.editable" type="button" class="guestreview-link" @click="startEditing">{{ t('reviews.edit') }}</button>
    </template>
  </section>
</template>

<script setup>
// Dizajn 39 and 43: the guest's review of a completed booking, inside the
// booking's card. 568:673 draws the form and 568:698 the posted review. A
// review is public the moment it is sent, and the guest can change it until
// the day the note names (review_edit_days, a week by default, 585:515).
import { formatBookingDate } from '~/utils/bookingRequests'

const props = defineProps({
  bookingId: { type: String, required: true },
  status: { type: Object, required: true },
})
const emit = defineEmits(['saved'])
const { t } = useI18n()
const api = useApi()

const uid = useId()
const titleId = `${uid}-title`
const ratingLabelId = `${uid}-rating`
const commentId = `${uid}-comment`

const mine = computed(() => props.status.myReview)

const editing = ref(false)
const showForm = computed(() => props.status.canReview || editing.value)

const form = reactive({ rating: 0, comment: '' })
const hovered = ref(0)
const saving = ref(false)
const error = ref('')

// "28. 9. 2026.", the last day the review can change.
const editableUntilText = computed(() => (mine.value?.editableUntil ? formatBookingDate(mine.value.editableUntil) : ''))

function startEditing() {
  form.rating = mine.value.rating
  form.comment = mine.value.comment || ''
  error.value = ''
  editing.value = true
}

function stopEditing() {
  editing.value = false
  error.value = ''
}

// Arrows move the choice like a radio group; the focus follows it.
function onStarKey(event, n) {
  const step = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[event.key]
  if (!step) return
  event.preventDefault()
  const next = Math.min(5, Math.max(1, (form.rating || n) + step))
  form.rating = next
  event.currentTarget.parentElement.children[next - 1]?.focus()
}

async function save() {
  error.value = ''
  saving.value = true
  try {
    const comment = form.comment.trim()
    if (editing.value) {
      await api.patch(`/reviews/${mine.value.id}`, { rating: form.rating, comment })
    } else {
      await api.post('/reviews', { bookingId: props.bookingId, rating: form.rating, comment: comment || undefined })
    }
    editing.value = false
    emit('saved')
  } catch (e) {
    error.value = extractErrorMessage(e, t('auth.genericError'))
    // A change refused because its week ran out meanwhile: the reload takes
    // the edit link away, while the form keeps saying why.
    if (editing.value && e?.response?.status === 400) emit('saved')
  } finally {
    saving.value = false
  }
}
</script>

<style lang="scss" scoped>
// 568:673 and 568:857: a white panel inside the booking's card, 26 / 28
// inside, its parts 18 apart. Figma draws the stroke inside the box.
$guestreview-success-bg: #cdfad1;
$guestreview-success: #0f731f;

.guestreview {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 18px;
  padding: 26px 28px;
  border-radius: 20px;
  background: $color-surface;
  box-shadow: inset 0 0 0 1px $color-border;
}

.guestreview-title {
  font-size: 17px;
  font-weight: 600;
  line-height: normal;
  color: $color-text;
}

// 568:675, 568:687
.guestreview-label {
  font-size: 14px;
  font-weight: 500;
  line-height: normal;
  color: $color-text;
}

// 568:676: five 26 stars, 6 apart.
.guestreview-stars {
  display: flex;
  gap: 6px;
}

.guestreview-star {
  display: block;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
}

.guestreview-star img {
  display: block;
  width: 26px;
  height: 26px;
}

.guestreview-star:focus-visible {
  outline: 2px solid $color-primary;
  outline-offset: 2px;
  border-radius: 4px;
}

// 568:688
.guestreview-textarea {
  display: block;
  width: 100%;
  height: 110px;
  padding: 14px 16px;
  border: 0;
  border-radius: $radius-input;
  background: $color-background;
  box-shadow: inset 0 0 0 1px $color-border;
  font-family: inherit;
  font-size: 15px;
  font-weight: 400;
  line-height: normal;
  color: $color-text;
  resize: none;
}

.guestreview-textarea::placeholder {
  color: $color-text-muted;
  opacity: 1;
}

.guestreview-textarea:focus {
  outline: none;
  box-shadow: inset 0 0 0 1.5px $color-primary;
}

.guestreview-buttons {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 18px;
}

// 568:690: a blue pill, at half strength until a rating is chosen.
.guestreview-submit {
  padding: 14px 28px;
  border: 0;
  border-radius: $radius-pill;
  background: $color-primary;
  font-family: inherit;
  font-size: 15px;
  font-weight: 500;
  line-height: normal;
  color: $color-surface;
  white-space: nowrap;
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.guestreview-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.guestreview-submit:not(:disabled):hover {
  opacity: 0.92;
}

// The change and its cancel: text buttons in the brand colour.
.guestreview-link {
  padding: 0;
  border: 0;
  background: none;
  font-family: inherit;
  font-size: 14px;
  font-weight: 500;
  line-height: normal;
  color: $color-primary;
  cursor: pointer;
}

.guestreview-link:hover {
  text-decoration: underline;
}

.guestreview-link:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

// 568:692 (blue, with the icon) and 585:514 (green).
.guestreview-note {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
  padding: 13px 16px;
  border-radius: $radius-input;
  font-size: 13px;
  font-weight: 400;
  line-height: 20px;
}

.guestreview-note.is-info {
  background: $color-accent-tint;
  color: $color-primary;
}

.guestreview-note.is-success {
  background: $guestreview-success-bg;
  color: $guestreview-success;
}

.guestreview-note-icon {
  display: block;
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  margin-top: 2px;
}

.guestreview-error {
  font-size: 13px;
  line-height: 20px;
  color: $color-error;
}

// 568:859: 22 stars, 6 apart.
.guestreview-rating {
  display: flex;
  gap: 6px;
}

.guestreview-rating img {
  display: block;
  width: 22px;
  height: 22px;
}

// 568:870
.guestreview-comment {
  width: 100%;
  font-size: 15px;
  font-weight: 400;
  line-height: 23px;
  color: $color-text;
  overflow-wrap: anywhere;
  white-space: pre-line;
}

@include mobile-only {
  .guestreview {
    padding: 22px 16px;
  }
}
</style>
