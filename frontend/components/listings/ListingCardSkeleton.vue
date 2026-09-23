<template>
  <div class="card-skeleton" aria-hidden="true">
    <SkeletonBox class="card-skeleton-media" height="200px" radius="0" />

    <div class="card-skeleton-body">
      <div class="card-skeleton-title-row">
        <div class="card-skeleton-title">
          <SkeletonBox height="14px" />
          <SkeletonBox width="62%" height="14px" />
        </div>
        <SkeletonBox width="40px" height="14px" />
      </div>

      <div class="card-skeleton-facts">
        <span class="card-skeleton-fact">
          <SkeletonBox width="15px" height="15px" radius="4px" />
          <SkeletonBox width="58px" height="13px" />
        </span>
        <span class="card-skeleton-fact">
          <SkeletonBox width="15px" height="15px" radius="4px" />
          <SkeletonBox width="48px" height="13px" />
        </span>
      </div>

      <div class="card-skeleton-divider" />

      <div class="card-skeleton-footer">
        <SkeletonBox width="116px" height="16px" />
        <SkeletonBox width="30px" height="30px" radius="999px" />
      </div>
    </div>
  </div>
</template>

<script setup>
// Dizajn 44: "za kartice oglasa: skeleton kartica istih dimenzija". Every box
// below sits where ListingCard's own element does, at its size and rounding:
// the 200 tall photo, the title's fixed 171 by 36 two-line box beside the
// rating, the key facts, the divider and the price row with its 30 button.
</script>

<style lang="scss" scoped>
// ListingCard's own values (its radius is a local 20, not $radius-card).
$card-skeleton-radius: 20px;

.card-skeleton {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: $color-surface;
  border-radius: $card-skeleton-radius;
  box-shadow: $shadow-card;
  overflow: hidden;
}

.card-skeleton-media {
  flex-shrink: 0;
}

.card-skeleton-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
  padding: 16px 18px;
}

.card-skeleton-title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

// The card's title box: 171 wide, 36 tall, two lines however short the title.
.card-skeleton-title {
  display: flex;
  flex: 0 1 171px;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  height: 36px;
}

.card-skeleton-facts {
  display: flex;
  align-items: center;
  gap: 12px;
}

.card-skeleton-fact {
  display: flex;
  align-items: center;
  gap: 5px;
}

.card-skeleton-divider {
  height: 1px;
  margin-top: auto;
  background: $color-border;
}

.card-skeleton-footer {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
</style>
