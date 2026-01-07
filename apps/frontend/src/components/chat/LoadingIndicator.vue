<template>
  <div class="loading-container">
    <!-- AI 图标 -->
    <div class="ai-icon">
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z"
          fill="currentColor"
          class="ai-star"
        />
        <path
          d="M19 15L19.5 17L21.5 17.5L19.5 18L19 20L18.5 18L16.5 17.5L18.5 17L19 15Z"
          fill="currentColor"
          class="ai-sparkle"
        />
        <path
          d="M5 6L5.5 7.5L7 8L5.5 8.5L5 10L4.5 8.5L3 8L4.5 7.5L5 6Z"
          fill="currentColor"
          class="ai-sparkle"
        />
      </svg>
    </div>
    <!-- 流光文字 -->
    <span class="shimmer-text">{{ t('aiThinking') }}</span>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

defineOptions({
  name: 'LoadingIndicator',
})
</script>

<style scoped>
.loading-container {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 16px;
  background: var(--ai-message-bg, rgba(248, 250, 252, 0.8));
  border: 1px solid var(--ai-message-border, rgba(0, 0, 0, 0.06));
}

.ai-icon {
  color: var(--primary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: pulse 2s ease-in-out infinite;
}

.ai-star {
  transform-origin: center;
}

.ai-sparkle {
  animation: sparkle 1.5s ease-in-out infinite;
}

.ai-sparkle:nth-child(2) {
  animation-delay: 0.3s;
}

.ai-sparkle:nth-child(3) {
  animation-delay: 0.6s;
}

.shimmer-text {
  font-size: 14px;
  font-weight: 500;
  background: linear-gradient(
    90deg,
    var(--text-secondary-color) 0%,
    var(--text-secondary-color) 40%,
    var(--primary-color) 50%,
    var(--text-secondary-color) 60%,
    var(--text-secondary-color) 100%
  );
  background-size: 200% 100%;
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: shimmer 2s linear infinite;
}

@keyframes shimmer {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: -100% 0;
  }
}

@keyframes pulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.8;
  }
}

@keyframes sparkle {
  0%,
  100% {
    opacity: 0.4;
  }
  50% {
    opacity: 1;
  }
}

/* 响应式 */
@media (max-width: 640px) {
  .loading-container {
    padding: 6px 12px;
    gap: 6px;
  }

  .shimmer-text {
    font-size: 13px;
  }

  .ai-icon svg {
    width: 16px;
    height: 16px;
  }
}
</style>
