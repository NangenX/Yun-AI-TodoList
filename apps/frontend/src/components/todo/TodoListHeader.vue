<template>
  <div class="header">
    <h1 style="margin-right: 10px">
      {{ t('appTitle') }}
    </h1>
    <div class="header-actions">
      <button
        class="icon-button ai-assistant-button"
        ref="aiBtnRef"
        :title="t('aiAssistant')"
        :aria-label="t('aiAssistant')"
        @click="$emit('openAiSidebar')"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          width="22"
          height="22"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="button-icon"
        >
          <!-- AI 神经网络风格图标 -->
          <!-- 中心节点 -->
          <circle cx="12" cy="12" r="2" fill="currentColor" />

          <!-- 外围节点 -->
          <circle cx="6" cy="6" r="1.5" fill="currentColor" />
          <circle cx="18" cy="6" r="1.5" fill="currentColor" />
          <circle cx="6" cy="18" r="1.5" fill="currentColor" />
          <circle cx="18" cy="18" r="1.5" fill="currentColor" />

          <!-- 连接线 -->
          <path d="M7.5 7.5L10 10" stroke="currentColor" opacity="0.6" />
          <path d="M16.5 7.5L14 10" stroke="currentColor" opacity="0.6" />
          <path d="M7.5 16.5L10 14" stroke="currentColor" opacity="0.6" />
          <path d="M16.5 16.5L14 14" stroke="currentColor" opacity="0.6" />

          <!-- 脉冲效果线条 -->
          <path d="M12 8V6" stroke="currentColor" opacity="0.4" />
          <path d="M12 18V16" stroke="currentColor" opacity="0.4" />
          <path d="M8 12H6" stroke="currentColor" opacity="0.4" />
          <path d="M18 12H16" stroke="currentColor" opacity="0.4" />
        </svg>
      </button>

      <button
        class="icon-button search-button"
        ref="searchBtnRef"
        :class="{ active: showSearch }"
        :title="`${showSearch ? t('closeSearch') : t('openSearch')}`"
        :aria-label="showSearch ? t('closeSearch') : t('openSearch')"
        @click="$emit('toggleSearch')"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          width="22"
          height="22"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="button-icon"
        >
          <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" />
          <path d="m21 21-6-6" />
        </svg>
      </button>

      <button
        class="icon-button charts-button"
        ref="chartsBtnRef"
        :class="{ active: showCharts }"
        :title="`${showCharts ? t('closeCharts') : t('openCharts')} (Ctrl+S)`"
        :aria-label="showCharts ? t('closeCharts') : t('openCharts')"
        @click="$emit('toggleCharts')"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          width="22"
          height="22"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="button-icon"
        >
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      </button>

      <!-- 布局切换：单列 / 双列 -->
      <button
        class="icon-button layout-button"
        ref="layoutBtnRef"
        :class="{ active: layoutMode === 'two_column' }"
        :title="
          layoutMode === 'two_column'
            ? t('switchToSingleColumn', '切换为单列')
            : t('switchToTwoColumn', '切换为双列')
        "
        :aria-label="
          layoutMode === 'two_column'
            ? t('switchToSingleColumn', '切换为单列')
            : t('switchToTwoColumn', '切换为双列')
        "
        @click="$emit('toggleLayoutMode')"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          width="22"
          height="22"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="button-icon"
        >
          <!-- 双列图标 -->
          <rect x="3" y="4" width="8" height="16" rx="2" ry="2" />
          <rect x="13" y="4" width="8" height="16" rx="2" ry="2" />
        </svg>
      </button>

      <!-- 首次使用顶部功能引导 -->
      <HeaderOnboarding
        :steps="onboardingSteps"
        :visible="showHeaderOnboarding"
        @finish="finishOnboarding"
        @skip="skipOnboarding"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import HeaderOnboarding from '@/components/onboarding/HeaderOnboarding.vue'

interface Props {
  showCharts: boolean
  showSearch: boolean
  isLoading?: boolean
  layoutMode?: 'list' | 'two_column'
}

interface Emits {
  (e: 'toggleCharts'): void
  (e: 'toggleSearch'): void
  (e: 'openAiSidebar'): void
  (e: 'toggleLayoutMode'): void
}

defineProps<Props>()
defineEmits<Emits>()

const { t } = useI18n()

defineOptions({
  name: 'TodoListHeader',
})

// 引导相关：四个按钮的引用
const aiBtnRef = ref<HTMLButtonElement | null>(null)
const searchBtnRef = ref<HTMLButtonElement | null>(null)
const chartsBtnRef = ref<HTMLButtonElement | null>(null)
const layoutBtnRef = ref<HTMLButtonElement | null>(null)

const showHeaderOnboarding = ref(false)
const ONBOARDING_STORAGE_KEY = 'onboarding.header.seen'

const onboardingSteps = [
  {
    targetRef: aiBtnRef,
    title: t('aiAssistant'),
    description: t('onboarding.header.aiDesc', '打开侧边栏，与 AI 交流、生成建议或进行优先级排序'),
  },
  {
    targetRef: searchBtnRef,
    title: t('openSearch'),
    description: t('onboarding.header.searchDesc', '打开搜索栏，按关键字快速过滤待办事项'),
  },
  {
    targetRef: chartsBtnRef,
    title: t('openCharts'),
    description: t(
      'onboarding.header.chartsDesc',
      '查看统计图表，了解完成率与任务分布（Ctrl+S 快捷键）'
    ),
  },
  {
    targetRef: layoutBtnRef,
    title: t('switchToTwoColumn', '布局切换'),
    description: t('onboarding.header.layoutDesc', '在单列与双列布局之间切换，提升浏览效率'),
  },
]

onMounted(() => {
  // 仅在首次使用时显示引导
  const seen = localStorage.getItem(ONBOARDING_STORAGE_KEY)
  if (!seen) {
    showHeaderOnboarding.value = true
  }
})

function finishOnboarding() {
  showHeaderOnboarding.value = false
  localStorage.setItem(ONBOARDING_STORAGE_KEY, '1')
}

function skipOnboarding() {
  showHeaderOnboarding.value = false
  localStorage.setItem(ONBOARDING_STORAGE_KEY, '1')
}
</script>

<style scoped>
.header {
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem;
}

h1 {
  color: #ff7e67;
  font-size: 1.8rem;
  font-weight: 600;
  margin: 0;
  text-shadow: 0 2px 4px rgba(255, 126, 103, 0.2);
  background: linear-gradient(135deg, #ff7e67 0%, #ff6b6b 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  flex-shrink: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-left: auto;
  white-space: nowrap;
  flex-wrap: wrap;
}

.icon-button {
  background: linear-gradient(135deg, var(--card-bg-color) 0%, rgba(255, 255, 255, 0.05) 100%);
  border: 1px solid rgba(255, 126, 103, 0.1);
  border-radius: 12px;
  cursor: pointer;
  padding: 0.75rem;
  color: var(--text-color);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  opacity: 0.85;
  position: relative;
  overflow: hidden;
  backdrop-filter: blur(10px);
  box-shadow:
    0 2px 8px rgba(0, 0, 0, 0.05),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  min-height: 44px;
}

.icon-button::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 126, 103, 0.1), transparent);
  transition: left 0.5s ease;
  z-index: 0;
}

.icon-button:hover::before {
  left: 100%;
}

.button-icon {
  fill: currentColor;
  transition: transform 0.3s ease;
  flex-shrink: 0;
  position: relative;
  z-index: 1;
}

.icon-button:hover {
  color: #ff7e67;
  opacity: 1;
  transform: translateY(-1px);
  border-color: rgba(255, 126, 103, 0.3);
  box-shadow:
    0 4px 16px rgba(255, 126, 103, 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

.icon-button:hover .button-icon {
  transform: scale(1.1);
}

.icon-button.active {
  color: #ffffff;
  opacity: 1;
  background: linear-gradient(135deg, #ff7e67 0%, #ff6b6b 100%);
  border-color: rgba(255, 126, 103, 0.5);
  box-shadow:
    0 2px 12px rgba(255, 126, 103, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

.icon-button.active .button-icon {
  transform: scale(1.05);
}

.icon-button:active {
  transform: translateY(0);
  box-shadow:
    0 1px 4px rgba(255, 126, 103, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.icon-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

.icon-button.loading {
  pointer-events: none;
}

.icon-button.loading .button-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.theme-toggle {
  position: relative;
}

.icon-button {
  position: relative;
}

.icon-button:hover {
  position: relative;
}

.icon-button::after {
  content: attr(title);
  position: absolute;
  bottom: calc(100% + 12px);
  left: 50%;
  transform: translateX(-50%) translateY(-5px);
  background: rgba(0, 0, 0, 0.9);
  color: white;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 400;
  white-space: nowrap;
  z-index: 1001;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  pointer-events: none;
  opacity: 0;
  visibility: hidden;
  transition:
    opacity 0.15s ease,
    visibility 0.15s ease,
    transform 0.15s ease;
}

.icon-button:hover::after {
  opacity: 1;
  visibility: visible;
  transform: translateX(-50%) translateY(0);
  transition:
    opacity 0.15s ease,
    visibility 0.15s ease,
    transform 0.15s ease;
}

@media (max-width: 768px) {
  .header {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .header-actions {
    justify-content: flex-end;
    margin-left: auto;
    gap: 0.75rem;
  }

  .icon-button {
    padding: 0.5rem;
    min-width: 40px;
    min-height: 40px;
    border-radius: 10px;
  }

  .button-icon {
    width: 20px;
    height: 20px;
  }
}

@media (max-width: 480px) {
  .header-actions {
    gap: 0.5rem;
  }

  .icon-button {
    padding: 0.4rem;
    min-width: 36px;
    min-height: 36px;
    border-radius: 9px;
  }

  .button-icon {
    width: 18px;
    height: 18px;
  }
}

/* 超小屏幕进一步优化 */
@media (max-width: 375px) {
  .header-actions {
    gap: 0.4rem;
  }

  .icon-button {
    padding: 0.35rem;
    min-width: 32px;
    min-height: 32px;
    border-radius: 8px;
  }

  .button-icon {
    width: 16px;
    height: 16px;
  }
}
</style>
