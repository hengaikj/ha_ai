<script setup lang="ts">
import BaseSectionTitle from "@/components/base/BaseSectionTitle.vue";

withDefaults(
  defineProps<{
    title?: string;
    description?: string;
    variant?: "default" | "focus" | "quiet";
    flush?: boolean;
  }>(),
  {
    title: "",
    description: "",
    variant: "default",
    flush: false,
  },
);
</script>

<template>
  <section
    class="committee-section bq-detail-panel"
    :class="[
      `committee-section--${variant}`,
      { 'committee-section--flush': flush },
    ]"
  >
    <BaseSectionTitle
      v-if="title || description || $slots['title-extra'] || $slots.actions"
      class="committee-section__header"
      :title="title"
      :description="description"
      heading-tag="h2"
    >
      <template v-if="$slots['title-extra']" #title-extra>
        <slot name="title-extra" />
      </template>
      <template v-if="$slots.actions" #actions>
        <slot name="actions" />
      </template>
    </BaseSectionTitle>
    <slot />
    <footer v-if="$slots.footer" class="committee-section__footer">
      <slot name="footer" />
    </footer>
  </section>
</template>

<style scoped>
.committee-section {
  min-width: 0;
}

.committee-section--focus {
  border-color: color-mix(in srgb, var(--bq-color-border), #c4cad3 28%);
  box-shadow: var(--bq-shadow-page);
}

.committee-section--quiet {
  box-shadow: none;
}

.committee-section--flush {
  gap: 0;
  padding: 0;
  overflow: hidden;
}

.committee-section__title {
  min-width: 0;
}

.committee-section__title-main {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.committee-section__actions,
.committee-section__footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  min-width: 0;
}

.committee-section__footer {
  padding-top: 4px;
}

@media (max-width: 680px) {
  .committee-section__header {
    align-items: stretch;
    flex-direction: column;
  }

  .committee-section__actions,
  .committee-section__footer {
    justify-content: flex-start;
  }
}
</style>
