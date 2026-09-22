<template>
  <div class="committee-page-stack">
    <slot />
  </div>
</template>

<style scoped>
.committee-page-stack {
  position: relative;
  display: grid;
  gap: var(--bq-space-section);
  min-width: 0;
}
</style>
