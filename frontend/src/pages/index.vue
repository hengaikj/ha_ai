<script setup lang="ts">
import PageContainer from "@/components/layout/PageContainer.vue";
import TechFlowBackdrop from "@/components/home/TechFlowBackdrop.vue";
import TechTitle from "@/components/home/TechTitle.vue";
import heroCar from "@/assets/images/home-hero-car.png";
</script>

<template>
  <PageContainer class="home-page" variant="plain" title="首页">
    <section class="home-hero" aria-labelledby="home-title">
      <TechFlowBackdrop />

      <div class="home-hero__copy">
        <TechTitle id="home-title" />
        <div class="home-hero__rule" aria-hidden="true" />
      </div>

      <div class="home-hero__visual" aria-hidden="true">
        <img
          class="home-hero__car"
          data-test="home-hero-car"
          :src="heroCar"
          width="800"
          height="339"
          decoding="async"
          alt=""
        />
      </div>

      <span
        class="home-hero__corner home-hero__corner--top"
        aria-hidden="true"
      />
      <span
        class="home-hero__corner home-hero__corner--bottom"
        aria-hidden="true"
      />
    </section>
  </PageContainer>
</template>

<style scoped>
.home-page {
  min-width: 0;
  height: calc(
    100vh - var(--bq-header-height) - var(--bq-tags-height) -
      var(--app-route-tags-height) - 20px
  );
  min-height: 0;
}

.home-page :deep(.page-container__body) {
  height: 100%;
  min-height: 0;
}

.home-hero {
  position: relative;
  isolation: isolate;
  display: grid;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  place-items: center;
  border: 1px solid var(--bq-color-border-subtle);
  border-radius: 10px;
  background:
    radial-gradient(
      circle at 50% 82%,
      color-mix(in srgb, var(--bq-color-primary-blue) 6%, transparent),
      transparent 42%
    ),
    linear-gradient(145deg, #fcfdff 0%, #f5f9ff 58%, #eef5ff 100%);
  box-shadow: 0 12px 32px rgba(48, 84, 135, 0.08);
}

.home-hero::before {
  position: absolute;
  inset: 14px;
  z-index: 1;
  border: 1px solid
    color-mix(in srgb, var(--bq-color-primary-blue) 10%, transparent);
  border-radius: 7px;
  content: "";
  pointer-events: none;
}

.home-hero::after {
  position: absolute;
  right: 12%;
  bottom: 18%;
  left: 12%;
  z-index: 2;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent,
    color-mix(in srgb, var(--bq-color-primary-blue) 21%, transparent) 22%,
    color-mix(in srgb, var(--bq-color-primary-blue) 7%, transparent) 78%,
    transparent
  );
  content: "";
  pointer-events: none;
}

.home-hero__copy {
  position: absolute;
  top: 23%;
  z-index: 5;
  display: grid;
  justify-items: center;
  width: min(90%, 680px);
  text-align: center;
}

.home-hero__rule {
  position: relative;
  width: min(180px, 32vw);
  height: 2px;
  margin-top: 24px;
  overflow: hidden;
  background: color-mix(in srgb, var(--bq-color-primary-blue) 25%, transparent);
}

.home-hero__rule::after {
  position: absolute;
  top: 0;
  bottom: 0;
  left: -34%;
  width: 34%;
  background: var(--bq-color-primary-blue);
  content: "";
  animation: home-rule-sweep 7s ease-in-out infinite;
  will-change: transform;
}

.home-hero__visual {
  position: absolute;
  inset: auto 0 5%;
  z-index: 3;
  height: 56%;
  pointer-events: none;
}

.home-hero__visual::before {
  position: absolute;
  right: 12%;
  bottom: 6%;
  left: 12%;
  height: 60%;
  border-radius: 50%;
  background: radial-gradient(
    ellipse at center,
    color-mix(in srgb, var(--bq-color-primary-blue) 14%, transparent),
    transparent 68%
  );
  content: "";
}

.home-hero__car {
  position: absolute;
  bottom: 0;
  left: 50%;
  display: block;
  width: min(84vw, 1080px);
  height: auto;
  opacity: 0.88;
  transform: translateX(-50%);
}

.home-hero__corner {
  position: absolute;
  z-index: 6;
  width: 56px;
  height: 56px;
  border-color: color-mix(
    in srgb,
    var(--bq-color-primary-blue) 28%,
    transparent
  );
  border-style: solid;
  pointer-events: none;
}

.home-hero__corner--top {
  top: 20px;
  left: 20px;
  border-width: 1px 0 0 1px;
}

.home-hero__corner--bottom {
  right: 20px;
  bottom: 20px;
  border-width: 0 1px 1px 0;
}

@keyframes home-rule-sweep {
  0%,
  18% {
    transform: translateX(0);
    opacity: 0.25;
  }

  62%,
  100% {
    transform: translateX(400%);
    opacity: 1;
  }
}

@media (max-width: 820px) {
  .home-hero {
    border-radius: 8px;
  }

  .home-hero::before {
    inset: 10px;
  }

  .home-hero__copy {
    top: 22%;
    width: min(88%, 640px);
  }

  .home-hero__visual {
    bottom: 4%;
    height: 52%;
  }

  .home-hero__car {
    width: min(94vw, 900px);
  }

  .home-hero__corner {
    width: 42px;
    height: 42px;
  }

  .home-hero__corner--top {
    top: 14px;
    left: 14px;
  }

  .home-hero__corner--bottom {
    right: 14px;
    bottom: 14px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .home-hero__rule::after {
    animation: none;
  }
}
</style>
