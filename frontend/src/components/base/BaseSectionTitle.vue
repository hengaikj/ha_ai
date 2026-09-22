<template>
  <component
    :is="'header'"
    class="base-section-title"
    :class="`base-section-title--${size}`"
  >
    <div class="base-section-title__main">
      <div class="base-section-title__heading-row">
        <component :is="headingTag" class="base-section-title__heading">
          <span class="base-section-title__text">{{ title }}</span>
        </component>
        <slot name="title-extra" />
      </div>
      <p v-if="description" class="base-section-title__description">
        {{ description }}
      </p>
    </div>
    <span v-if="$slots.actions" class="base-section-title__actions">
      <slot name="actions" />
    </span>
  </component>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    title?: string;
    description?: string;
    size?: "default" | "small";
    headingTag?: "h2" | "h3" | "h4" | "div";
  }>(),
  {
    title: "",
    description: "",
    size: "default",
    headingTag: "h2",
  },
);
</script>

<style scoped>
.base-section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 9px;
  min-width: 0;
  width: 100%;
  min-height: 32px;
  margin: 0;
  padding-bottom: 10px;
  border-bottom: 1px solid
    var(--bq-color-border-subtle, var(--el-border-color-lighter));
}

.base-section-title::before {
  flex: 0 0 auto;
  width: 4px;
  height: 24px;
  border-radius: 2px;
  background: var(--bq-color-primary-blue, var(--el-color-primary));
  content: "";
}

.base-section-title__heading {
  flex: 0 0 auto;
  min-width: 0;
  margin: 0;
  color: var(--bq-color-text, var(--el-text-color-primary));
  font-size: var(--bq-font-section-title, 16px);
  font-weight: 700;
  line-height: 24px;
}

.base-section-title__main {
  flex: 1 1 auto;
  min-width: 0;
}

.base-section-title__heading-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.base-section-title__description {
  margin: 4px 0 0;
  color: var(--bq-color-text-secondary, var(--el-text-color-secondary));
  font-size: 14px;
  line-height: 18px;
}

.base-section-title--small {
  min-height: 24px;
  padding-bottom: 0;
  border-bottom: 0;
}

.base-section-title--small .base-section-title__heading {
  font-size: 14px;
  line-height: 22px;
}

.base-section-title--small::before {
  flex-basis: auto;
  width: 3px;
  height: 18px;
}

.base-section-title__text {
  min-width: 0;
  overflow-wrap: anywhere;
}

.base-section-title__actions {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  gap: 8px;
}

</style>
