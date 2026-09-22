<template>
  <div class="tech-flow-backdrop" aria-hidden="true">
    <span class="tech-flow-backdrop__orbit tech-flow-backdrop__orbit--wide" />
    <span class="tech-flow-backdrop__orbit tech-flow-backdrop__orbit--tight" />
    <span class="tech-flow-backdrop__rail tech-flow-backdrop__rail--top" />
    <span class="tech-flow-backdrop__rail tech-flow-backdrop__rail--bottom" />
    <span class="tech-flow-backdrop__node tech-flow-backdrop__node--one" />
    <span class="tech-flow-backdrop__node tech-flow-backdrop__node--two" />
    <span class="tech-flow-backdrop__node tech-flow-backdrop__node--three" />
    <span class="tech-flow-backdrop__node tech-flow-backdrop__node--four" />
  </div>
</template>

<style scoped>
.tech-flow-backdrop {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
}

.tech-flow-backdrop::before {
  position: absolute;
  right: 7%;
  bottom: 4%;
  left: 7%;
  height: 54%;
  border-radius: 50%;
  background: radial-gradient(
    ellipse at center,
    color-mix(in srgb, var(--bq-color-primary-blue) 13%, transparent),
    transparent 68%
  );
  content: "";
}

.tech-flow-backdrop::after {
  position: absolute;
  top: 14%;
  right: 0;
  width: 34%;
  height: 42%;
  background: radial-gradient(
    circle at center,
    color-mix(in srgb, var(--bq-color-primary-blue) 7%, transparent),
    transparent 70%
  );
  content: "";
}

.tech-flow-backdrop__orbit,
.tech-flow-backdrop__rail,
.tech-flow-backdrop__node {
  position: absolute;
  display: block;
}

.tech-flow-backdrop__orbit {
  border: 1px solid
    color-mix(in srgb, var(--bq-color-primary-blue) 14%, transparent);
  border-radius: 50%;
  transform: rotate(-10deg);
}

.tech-flow-backdrop__orbit--wide {
  right: -14%;
  bottom: 9%;
  width: 78%;
  height: 34%;
}

.tech-flow-backdrop__orbit--tight {
  right: -6%;
  bottom: 15%;
  width: 62%;
  height: 25%;
  border-color: color-mix(
    in srgb,
    var(--bq-color-primary-blue) 10%,
    transparent
  );
  transform: rotate(-7deg);
}

.tech-flow-backdrop__rail {
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent,
    color-mix(in srgb, var(--bq-color-primary-blue) 16%, transparent) 24%,
    color-mix(in srgb, var(--bq-color-primary-blue) 5%, transparent) 76%,
    transparent
  );
}

.tech-flow-backdrop__rail--top {
  top: 17%;
  right: 7%;
  width: 28%;
}

.tech-flow-backdrop__rail--bottom {
  bottom: 12%;
  left: 8%;
  width: 26%;
  opacity: 0.7;
}

.tech-flow-backdrop__node {
  width: 5px;
  height: 5px;
  border: 1px solid
    color-mix(in srgb, var(--bq-color-primary-blue) 30%, transparent);
  border-radius: 50%;
  background: var(--bq-color-surface);
  box-shadow: 0 0 0 3px
    color-mix(in srgb, var(--bq-color-primary-blue) 7%, transparent);
}

.tech-flow-backdrop__node--one {
  top: 24%;
  left: 13%;
}

.tech-flow-backdrop__node--two {
  top: 29%;
  right: 17%;
}

.tech-flow-backdrop__node--three {
  bottom: 27%;
  left: 24%;
}

.tech-flow-backdrop__node--four {
  right: 11%;
  bottom: 24%;
}

@media (max-width: 820px) {
  .tech-flow-backdrop__orbit--wide {
    right: -40%;
    width: 120%;
    height: 36%;
  }

  .tech-flow-backdrop__orbit--tight {
    right: -26%;
    width: 98%;
  }

  .tech-flow-backdrop__rail--top {
    top: 14%;
    right: 10%;
    width: 34%;
  }

  .tech-flow-backdrop__rail--bottom {
    bottom: 11%;
    left: 10%;
    width: 30%;
  }
}
</style>
