<template>
  <div class="under-development-container">
    <!-- 装饰背景 -->
    <div class="blob blob-1"></div>
    <div class="blob blob-2"></div>

    <!-- 主内容区域 -->
    <div class="content-wrapper">
      <!-- SVG 插画区域 -->
      <div class="illustration-section animate-fade-in">
        <div class="illustration-container">
          <!-- 外层光晕 -->
          <div class="glow-effect animate-pulse-glow"></div>

          <!-- 主插画容器 -->
          <div class="gears-wrapper">
            <!-- 大齿轮 (主) -->
            <svg
                class="gear gear-large animate-rotate-slow"
                viewBox="0 0 100 100"
                fill="none"
            >
              <defs>
                <linearGradient
                    id="gearGradient"
                    x1="0%"
                    y1="0%"
                    x2="100%"
                    y2="100%"
                >
                  <stop offset="0%" style="stop-color: #3b82f6" />
                  <stop offset="100%" style="stop-color: #6366f1" />
                </linearGradient>
              </defs>
              <path
                  d="M50 10 L54 10 L55.5 18 C57.5 18.5 59.5 19.2 61.2 20.2 L68 14 L72 18 L66.5 25 C67.5 27 68.2 29 68.8 31 L78 32.5 L78 36.5 L69 39 C69 41 68.3 43 67.5 44.8 L74 51.5 L70.5 55.5 L64 49.5 C62 50.5 59.8 51.2 57.5 51.5 L56.5 59 L52.5 59 L51.5 51.5 C49.2 51.2 47 50.5 45 49.5 L38.5 55.5 L35 51.5 L41.5 44.8 C40.7 43 40 41 40 39 L31 36.5 L31 32.5 L40.2 31 C40.8 29 41.5 27 42.5 25 L37 18 L41 14 L47.8 20.2 C49.5 19.2 51.5 18.5 53.5 18 L55 10 Z"
                  fill="url(#gearGradient)"
                  opacity="0.9"
              />
              <circle
                  cx="50"
                  cy="50"
                  r="16"
                  fill="white"
                  stroke="url(#gearGradient)"
                  stroke-width="4"
              />
              <circle cx="50" cy="50" r="8" fill="url(#gearGradient)" />
            </svg>

            <!-- 小齿轮 (从动) -->
            <svg
                class="gear gear-small animate-rotate-reverse"
                viewBox="0 0 100 100"
                fill="none"
            >
              <defs>
                <linearGradient
                    id="gearGradient2"
                    x1="0%"
                    y1="0%"
                    x2="100%"
                    y2="100%"
                >
                  <stop offset="0%" style="stop-color: #60a5fa" />
                  <stop offset="100%" style="stop-color: #818cf8" />
                </linearGradient>
              </defs>
              <path
                  d="M50 15 L53 15 L54.5 22 C56 22.3 57.5 23 58.8 23.8 L65 19 L68 23 L62.5 29 C63.2 30.5 63.7 32 64 33.5 L71 35 L71 38 L64.5 39.5 C64.5 41 64 42.5 63.2 44 L68.5 50 L65.5 53.5 L60 48 C58.5 48.7 57 49.2 55.5 49.5 L54.5 56 L51 56 L50 49.5 C48.5 49.2 47 48.7 45.5 48 L40 53.5 L37 50 L42.8 44 C42 42.5 41.5 41 41.5 39.5 L35 38 L35 35 L41 33.5 C41 32 41.5 30.5 42.3 29 L37 23 L40 19 L46.2 23.8 C47.5 23 49 22.3 50.5 22 L52 15 Z"
                  fill="url(#gearGradient2)"
                  opacity="0.85"
              />
              <circle
                  cx="50"
                  cy="50"
                  r="14"
                  fill="white"
                  stroke="url(#gearGradient2)"
                  stroke-width="3"
              />
              <circle cx="50" cy="50" r="7" fill="url(#gearGradient2)" />
            </svg>

            <!-- 代码符号 - 左侧外部 -->
            <div class="icon-code animate-float-slow">
              <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#6366f1"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  opacity="0.6"
              >
                <polyline points="16 18 22 12 16 6"></polyline>
                <polyline points="8 6 2 12 8 18"></polyline>
              </svg>
            </div>

            <!-- 设置/工具符号 - 右上外部 -->
            <div
                class="icon-settings animate-float-slow"
                style="animation-delay: -2s"
            >
              <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#818cf8"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  opacity="0.5"
              >
                <circle cx="12" cy="12" r="3"></circle>
                <path
                    d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
                ></path>
              </svg>
            </div>
          </div>
        </div>
      </div>

      <!-- 主标题 -->
      <h1 class="title animate-fade-in-delay-1">
        <span class="gradient-text">功能开发中</span>
        <span class="suffix-text">，敬请期待~</span>
      </h1>

      <!-- 副标题 -->
      <p class="subtitle animate-fade-in-delay-2">我们正在努力打造更好的体验</p>

      <!-- 进度条 -->
      <div class="progress-container animate-fade-in-delay-2">
        <div class="loader-bar"></div>
      </div>
    </div>

    <!-- 底部装饰点 -->
    <div class="bottom-dots">
      <div class="dot dot-1"></div>
      <div class="dot dot-2"></div>
      <div class="dot dot-3"></div>
    </div>
  </div>
</template>

<script>
export default {
  name: "UnderDevelopment",
  data() {
    return {};
  },
};
</script>

<style lang="scss" scoped>
:global(.app-layout__content) {
  scrollbar-gutter: auto;
}

.under-development-container {
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  min-height: 100vh;
  min-height: 100dvh;
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  position: relative;
  background: linear-gradient(135deg, #f0f7ff 0%, #e0f2fe 50%, #f0f9ff 100%);
  font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
  Helvetica, Arial, sans-serif;
}

:global(.app-layout__content) .under-development-container {
  height: calc(
    100vh - var(--bq-header-height) - var(--bq-tags-height) - 20px
  );
  min-height: 0;
}

:global(.is-tags-view-enabled .app-layout__content)
  .under-development-container {
  height: calc(
    100vh - var(--bq-header-height) - var(--bq-tags-height) - 60px
  );
}

/* 装饰圆形 */
.blob {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
}

.blob-1 {
  width: 400px;
  height: 400px;
  background: radial-gradient(
      circle,
      rgba(59, 130, 246, 0.15) 0%,
      transparent 70%
  );
  top: -100px;
  right: -100px;
  animation: float-slow-blob 8s ease-in-out infinite;
}

.blob-2 {
  width: 300px;
  height: 300px;
  background: radial-gradient(
      circle,
      rgba(99, 102, 241, 0.12) 0%,
      transparent 70%
  );
  bottom: -50px;
  left: -80px;
  animation: float-slow-blob 10s ease-in-out infinite reverse;
}

/* 主内容区域 */
.content-wrapper {
  position: relative;
  z-index: 10;
  text-align: center;
  padding: 0 1.5rem;
  max-width: 32rem;
  margin: 0 auto;
}

/* 插画部分 */
.illustration-section {
  margin-bottom: 2.5rem;
}

.illustration-container {
  position: relative;
  display: inline-block;
}

.glow-effect {
  position: absolute;
  inset: 0;
  background-color: rgba(96, 165, 250, 0.2);
  border-radius: 9999px;
  filter: blur(40px);
}

.gears-wrapper {
  position: relative;
  width: 12rem;
  height: 12rem;
  margin: 0 auto;
}

.gear {
  position: absolute;
}

.gear-large {
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 9rem;
  height: 9rem;
}

.gear-small {
  top: 0;
  right: 0;
  width: 5rem;
  height: 5rem;
}

.icon-code {
  position: absolute;
  left: -2.5rem;
  top: 50%;
  transform: translateY(-50%);
}

.icon-settings {
  position: absolute;
  right: -2rem;
  top: -1rem;
}

/* 文字部分 */
.title {
  font-size: 1.875rem;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 1rem;
  letter-spacing: -0.025em;

  @media (min-width: 768px) {
    font-size: 2.25rem;
  }
}

.gradient-text {
  background: linear-gradient(to right, #2563eb, #4f46e5);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.suffix-text {
  color: #374151;
}

.subtitle {
  color: #6b7280;
  font-size: 1rem;
  margin-bottom: 2rem;
  line-height: 1.625;

  @media (min-width: 768px) {
    font-size: 1.125rem;
  }
}

/* 进度条 */
.progress-container {
  width: 12rem;
  height: 0.375rem;
  background-color: #dbeafe;
  border-radius: 9999px;
  margin: 0 auto;
  overflow: hidden;
}

.loader-bar {
  height: 100%;
  border-radius: 9999px;
  background: linear-gradient(
      90deg,
      transparent,
      rgba(59, 130, 246, 0.4),
      transparent
  );
  animation: loading 2s ease-in-out infinite;
}

/* 底部装饰点 */
.bottom-dots {
  position: absolute;
  bottom: 2rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 0.5rem;
}

.dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

.dot-1 {
  background-color: rgba(96, 165, 250, 0.5);
}
.dot-2 {
  background-color: rgba(129, 140, 248, 0.5);
  animation-delay: 0.2s;
}
.dot-3 {
  background-color: rgba(192, 132, 252, 0.5);
  animation-delay: 0.4s;
}

/* 动画定义 */
@keyframes rotate-slow {
  from {
    transform: translate(-50%, -50%) rotate(0deg);
  }
  to {
    transform: translate(-50%, -50%) rotate(360deg);
  }
}

@keyframes rotate-reverse {
  from {
    transform: rotate(360deg);
  }
  to {
    transform: rotate(0deg);
  }
}

@keyframes float-slow-blob {
  0%,
  100% {
    transform: translate(0, 0) scale(1);
  }
  50% {
    transform: translate(20px, -20px) scale(1.05);
  }
}

@keyframes float-slow {
  0%,
  100% {
    transform: translateY(-50%) translate(0, 0);
  }
  50% {
    transform: translateY(-50%) translate(0, -10px);
  }
}

@keyframes pulse-glow {
  0%,
  100% {
    opacity: 0.6;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.05);
  }
}

@keyframes loading {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-rotate-slow {
  animation: rotate-slow 20s linear infinite;
}
.animate-rotate-reverse {
  animation: rotate-reverse 15s linear infinite;
}
.animate-float-slow {
  animation: float-slow 6s ease-in-out infinite;
}
.animate-pulse-glow {
  animation: pulse-glow 3s ease-in-out infinite;
}
.animate-fade-in {
  animation: fade-in-up 0.8s ease-out forwards;
}

.animate-fade-in-delay-1 {
  animation: fade-in-up 0.8s ease-out 0.2s forwards;
  opacity: 0;
}

.animate-fade-in-delay-2 {
  animation: fade-in-up 0.8s ease-out 0.4s forwards;
  opacity: 0;
}
</style>
