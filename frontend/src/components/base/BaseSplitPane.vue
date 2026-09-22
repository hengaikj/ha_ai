<script setup lang="ts">
withDefaults(
  defineProps<{
    sideWidth?: string;
  }>(),
  {
    sideWidth: "280px",
  },
);
</script>

<template>
  <section class="base-split-pane" :style="{ '--side-width': sideWidth }">
    <div class="base-split-pane__side">
      <slot name="side" />
    </div>
    <div class="base-split-pane__main">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.base-split-pane {
  display: grid;
  grid-template-columns: var(--side-width) minmax(0, 1fr);
  gap: var(--bq-space-section);
  min-width: 0;
}

.base-split-pane__side,
.base-split-pane__main {
  min-width: 0;
}

@media (max-width: 960px) {
  .base-split-pane {
    grid-template-columns: 1fr;
  }
}
</style>
