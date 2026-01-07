<template>
  <div class="header">
    <h1 style="margin-right: 10px">
      {{ t('appTitle') }}
    </h1>
    <div class="header-actions">
      <button
        ref="aiBtnRef"
        class="icon-button ai-assistant-button"
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
        ref="searchBtnRef"
        class="icon-button search-button"
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

      <!-- 布局切换：单列 / 双列 -->
      <button
        ref="layoutBtnRef"
        class="icon-button layout-button"
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

      <!-- 单独图标：一键分析（批量分析） -->
      <button
        ref="batchAnalyzeBtnRef"
        class="icon-button batch-analyze-button"
        :disabled="isBatchAnalyzing || isAnalyzing || isSorting || !hasUnanalyzedTodos"
        :title="
          isBatchAnalyzing
            ? t('batchAnalyzing', '批量分析中...')
            : isAnalyzing || isSorting
              ? t('loading', '正在进行其他操作，请稍候...')
              : t('batchAnalyze', '一键分析')
        "
        :aria-label="t('batchAnalyze')"
        @click="handleBatchAnalyzeClick"
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
          <path d="M9 12l2 2 4-4" />
          <path d="M21 12c-1 0-3-1-3-3s2-3 3-3 3 1 3 3-2 3-3 3" />
          <path d="M3 12c1 0 3-1 3-3s-2-3-3-3-3 1-3 3 2 3 3 3" />
        </svg>
      </button>

      <!-- 单独图标：AI 优先级排序 -->
      <button
        ref="aiSortBtnRef"
        class="icon-button ai-sort-button"
        :disabled="isSorting || isAnalyzing || isBatchAnalyzing || !hasActiveTodos"
        :title="
          isSorting
            ? t('sorting')
            : isAnalyzing || isBatchAnalyzing
              ? t('loading', '正在进行 AI 分析，请稍候...')
              : t('aiPrioritySort', 'AI 优先级排序')
        "
        :aria-label="t('aiPrioritySort')"
        @click="handleSortWithAIClick"
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
          <path d="M3 6h18" />
          <path d="M7 12h10" />
          <path d="M10 18h4" />
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
import HeaderOnboarding from '@/components/onboarding/HeaderOnboarding.vue'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

interface Props {
  showSearch: boolean
  isLoading?: boolean
  layoutMode?: 'list' | 'two_column'
  // 新增：用于控制 AI 菜单条目的禁用状态
  isAnalyzing?: boolean
  isSorting?: boolean
  isBatchAnalyzing?: boolean
  isGenerating?: boolean
  hasUnanalyzedTodos?: boolean
  hasActiveTodos?: boolean
}

interface Emits {
  (e: 'toggleSearch'): void
  (e: 'openAiSidebar'): void
  (e: 'toggleLayoutMode'): void
  // 新增：AI 相关操作事件
  (e: 'sort-with-ai'): void
  (e: 'batchAnalyze'): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()

const { t } = useI18n()

defineOptions({
  name: 'TodoListHeader',
})

// 引导相关：四个按钮的引用
const aiBtnRef = ref<HTMLButtonElement | null>(null)
const searchBtnRef = ref<HTMLButtonElement | null>(null)
const layoutBtnRef = ref<HTMLButtonElement | null>(null)
const batchAnalyzeBtnRef = ref<HTMLButtonElement | null>(null)
const aiSortBtnRef = ref<HTMLButtonElement | null>(null)

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
    targetRef: layoutBtnRef,
    title: t('switchToTwoColumn', '布局切换'),
    description: t('onboarding.header.layoutDesc', '在单列与双列布局之间切换，提升浏览效率'),
  },
  {
    targetRef: batchAnalyzeBtnRef,
    title: t('batchAnalyze', '一键分析'),
    description: t(
      'onboarding.header.batchAnalyzeDesc',
      '批量分析未分析的待办事项，自动生成建议与优先级信息（进行其他 AI 操作时会暂时不可用）'
    ),
  },
  {
    targetRef: aiSortBtnRef,
    title: t('aiPrioritySort', 'AI 优先级排序'),
    description: t(
      'onboarding.header.aiSortDesc',
      '基于重要性与紧急性，为待完成事项进行智能排序（需要至少 2 个活跃任务）'
    ),
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

function handleSortWithAIClick() {
  // 透传到父组件，由父组件负责具体逻辑
  emit('sort-with-ai')
}

function handleBatchAnalyzeClick() {
  emit('batchAnalyze')
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
  /* 统一到更柔和的主题边框色 */
  border: 1px solid var(--settings-card-border);
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
  /* 悬停闪光效果统一到主题色 */
  background: linear-gradient(
    90deg,
    transparent,
    rgba(var(--primary-color-rgb), 0.12),
    transparent
  );
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
  /* 悬停颜色统一为更柔和的主题主色 */
  color: var(--primary-color);
  opacity: 1;
  transform: translateY(-1px);
  border-color: var(--settings-primary-medium);
  box-shadow:
    0 4px 16px rgba(var(--primary-color-rgb), 0.18),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

.icon-button:hover .button-icon {
  transform: scale(1.1);
}

.icon-button.active {
  color: #ffffff;
  opacity: 1;
  background: linear-gradient(
    135deg,
    rgba(var(--primary-color-rgb), 0.88) 0%,
    rgba(var(--primary-color-rgb), 0.76) 100%
  );
  border-color: var(--settings-primary-medium);
  box-shadow:
    0 2px 12px rgba(var(--primary-color-rgb), 0.25),
    inset 0 1px 0 rgba(255, 255, 255, 0.18);
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

/* 顶部独立 AI 操作按钮（与其他 icon-button 保持一致风格） */
.batch-analyze-button,
.ai-sort-button {
  /* 使用通用样式，不额外突出显示，保证不显眼 */
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
