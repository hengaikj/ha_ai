<script setup lang="ts">
import { watch } from "vue";
import { useRoute } from "vue-router";
import { ElMessageBox } from "element-plus";

const route = useRoute();

watch(
  () => route.fullPath,
  () => ElMessageBox.close(),
);
</script>

<template>
  <router-view v-slot="{ Component, route: viewRoute }">
    <Transition
      name="fade-transform"
      mode="out-in"
      :css="viewRoute.meta.hidden !== true"
    >
      <KeepAlive>
        <component
          :is="Component"
          v-if="viewRoute.meta.cacheable === true"
          :key="viewRoute.fullPath"
        />
      </KeepAlive>
    </Transition>
    <Transition
      v-if="viewRoute.meta.cacheable !== true && viewRoute.meta.hidden !== true"
      name="fade-transform"
      mode="out-in"
    >
      <div :key="viewRoute.fullPath" class="route-view-shell">
        <component :is="Component" />
      </div>
    </Transition>
    <component
      :is="Component"
      v-else-if="viewRoute.meta.cacheable !== true"
      :key="viewRoute.fullPath"
    />
  </router-view>
</template>

<style scoped>
.route-view-shell {
  min-height: 100%;
}

.fade-transform-enter-active,
.fade-transform-leave-active {
  transition: all 0.3s;
}

.fade-transform-enter-from {
  opacity: 0;
  transform: translateX(-30px);
}

.fade-transform-leave-to {
  opacity: 0;
  transform: translateX(30px);
}
</style>
