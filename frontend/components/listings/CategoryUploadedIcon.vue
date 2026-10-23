<template>
  <!-- T129: an icon the admin uploaded for a category (or, through
       AttributeIcon, for a field or an amenity item). The backend keeps only
       its shape (black where the icon is, see-through round it), and the shape
       is filled with the text colour, so it turns grey, blue or dark with the
       card or tile around it, like the library's SVG icons. An inline SVG mask
       rather than CSS mask-image: the public bucket sends no CORS headers, and
       browsers refuse a CSS mask from another origin without them. -->
  <svg class="category-uploaded-icon" viewBox="0 0 30 30" width="30" height="30" aria-hidden="true" focusable="false">
    <mask :id="maskId" maskUnits="userSpaceOnUse" x="0" y="0" width="30" height="30" style="mask-type: alpha">
      <image :href="src" x="0" y="0" width="30" height="30" preserveAspectRatio="xMidYMid meet" />
    </mask>
    <rect width="30" height="30" fill="currentColor" :mask="`url(#${maskId})`" />
  </svg>
</template>

<script setup>
defineProps({
  src: { type: String, required: true },
})

// Every icon on a page needs its own mask id; useId keeps it the same on the server and in the browser.
const maskId = `category-icon-${useId().replace(/[^\w-]/g, '')}`
</script>
