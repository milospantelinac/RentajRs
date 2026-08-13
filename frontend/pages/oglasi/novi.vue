<template>
  <div class="container wizard-start">
    <h1 class="text-page-title mb-4">{{ t('listing.chooseCategory') }}</h1>
    <p v-if="error" class="form-error mb-3">{{ error }}</p>

    <div class="row">
      <div v-for="cat in categories" :key="cat.id" class="col-6 col-md-3 mb-3">
        <button class="category-tile card card-interactive" @click="selectCategory(cat.id)">
          <span class="text-body">{{ cat.name }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
definePageMeta({ middleware: 'auth' })
const { t } = useI18n()
const api = useApi()
const error = ref('')

const { data: categories } = await useAsyncData('wizard-categories', () => api.get('/categories'))

async function selectCategory(categoryId) {
  error.value = ''
  try {
    const listing = await api.post('/listings', { categoryId })
    await navigateTo(`/oglasi/${listing.id}/uredi`)
  } catch (e) {
    error.value = e?.data?.message?.[0] || e?.data?.message || t('auth.genericError')
  }
}

useSeoMeta({ title: t('listing.chooseCategory') })
</script>

<style lang="scss" scoped>
.wizard-start {
  padding: 40px 0;
}

.category-tile {
  width: 100%;
  padding: 24px 16px;
  text-align: center;
  cursor: pointer;
  border: 1px solid $color-border;
}

.category-tile:hover {
  border-color: $color-primary;
}
</style>
