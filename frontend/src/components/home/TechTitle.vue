<script setup lang="ts">
import titleImage from "@/assets/images/home-title.png";

withDefaults(
  defineProps<{
    text?: string;
    id?: string;
  }>(),
  {
    text: "欢迎使用收益与成本管理系统",
    id: undefined,
  },
);
</script>

<template>
  <div class="tech-title" data-test="tech-title">
    <h1 :id="id" class="tech-title__accessible">{{ text }}</h1>
    <img
      class="tech-title__image"
      data-test="home-title-image"
      :src="titleImage"
      width="900"
      height="116"
      decoding="async"
      fetchpriority="high"
      alt=""
      aria-hidden="true"
    />
  </div>
</template>

<style scoped>
.tech-title {
  position: relative;
  display: grid;
  width: 100%;
  justify-items: center;
}

.tech-title__image {
  position: relative;
  z-index: 1;
  display: block;
  width: min(100%, 800px);
  height: auto;
  object-fit: contain;
}

.tech-title__accessible {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 820px) {
  .tech-title__image {
    width: min(100%, 620px);
  }
}
</style>
