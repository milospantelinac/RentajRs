<template>
  <NuxtLink :to="`/oglasi/${listing.slug}`" class="card card-interactive listing-card">
    <div class="listing-card-image-wrap">
      <img
        v-if="listing.coverPhoto"
        :src="listing.coverPhoto.url"
        :alt="listing.coverPhoto.altText || listing.title"
        class="listing-card-image"
        loading="lazy"
      />
      <div v-else class="listing-card-image listing-card-image-placeholder" />
      <span v-if="listing.category?.icon" class="badge badge-neutral listing-card-category-badge">
        {{ useCategoryIcon(listing.category.icon) }}
      </span>
    </div>
    <div class="card-body-sm">
      <p class="text-body listing-card-title">{{ listing.title }}</p>
      <p class="text-muted listing-card-location">
        {{ listing.city?.name }}<span v-if="listing.cityArea">, {{ listing.cityArea.name }}</span>
      </p>
      <div class="listing-card-footer">
        <span class="text-body listing-card-price">
          {{ new Intl.NumberFormat('sr-RS').format(listing.price || 0) }} RSD
        </span>
        <span v-if="listing.avgRating" class="text-muted">★ {{ Number(listing.avgRating).toFixed(1) }}</span>
      </div>
    </div>
  </NuxtLink>
</template>

<script setup>
defineProps({
  listing: { type: Object, required: true },
})
</script>

<style lang="scss" scoped>
.listing-card {
  display: block;
  overflow: hidden;
}

.listing-card-image-wrap {
  position: relative;
}

.listing-card-image {
  width: 100%;
  height: 160px;
  object-fit: cover;
}

.listing-card-image-placeholder {
  background: $color-background;
}

.listing-card-category-badge {
  position: absolute;
  top: 10px;
  left: 10px;
}

.listing-card-title {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.listing-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
}

.listing-card-price {
  font-weight: 600;
}
</style>
