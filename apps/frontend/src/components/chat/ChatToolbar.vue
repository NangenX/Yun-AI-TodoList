<template>
  <div class="flex gap-3 px-6 md:px-4 md:gap-2">
    <button
      :disabled="isGenerating || isEmptyConversation"
      :class="[
        'px-4 py-2.5 text-sm border rounded-lg flex items-center gap-2 transition-all duration-200 h-10 md:px-3 md:py-2 md:text-[13px] md:h-9',
        isGenerating || isEmptyConversation
          ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed opacity-60'
          : 'bg-input-bg text-text border-input-border cursor-pointer hover:bg-button-hover hover:text-white hover:border-button-bg hover:shadow-[0_2px_8px_rgba(121,180,166,0.2)]',
      ]"
      @click="!(isGenerating || isEmptyConversation) && $emit('new')"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="currentColor"
        class="md:w-3.5 md:h-3.5"
      >
        <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
      </svg>
      {{ t('newConversation') }}
    </button>

    <!-- AI 思考模式开关 -->
    <div class="thinking-mode-toggle-wrapper">
      <label class="thinking-mode-toggle" :title="t('aiThinkingMode', 'AI 思考模式')">
        <input
          type="checkbox"
          :checked="thinkingEnabled"
          class="thinking-checkbox"
          @change="toggleThinkingMode"
        />
        <span class="thinking-toggle-slider"></span>
        <svg
          class="thinking-icon"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </label>
    </div>

    <button
      :class="[
        'px-3 py-2.5 text-sm border rounded-lg flex items-center justify-center transition-all duration-200 h-10 w-10 md:py-2 md:h-9 md:w-9',
        webSearchEnabled
          ? 'bg-button-bg text-white border-button-bg shadow-[0_2px_8px_rgba(121,180,166,0.3)]'
          : 'bg-input-bg text-text border-input-border hover:bg-button-hover hover:text-white hover:border-button-bg hover:shadow-[0_2px_8px_rgba(121,180,166,0.2)]',
      ]"
      :title="
        webSearchEnabled
          ? t('disableWebSearch', '关闭网络搜索')
          : t('enableWebSearch', '启用网络搜索')
      "
      @click="$emit('toggleWebSearch')"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        class="md:w-3.5 md:h-3.5"
      >
        <circle cx="11" cy="11" r="7" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    </button>

    <!-- 切换到上一次历史对话按钮 -->
    <button
      :disabled="isGenerating || !hasPreviousConversation"
      :class="[
        'px-4 py-2.5 text-sm border rounded-lg flex items-center gap-2 transition-all duration-200 h-10 md:px-3 md:py-2 md:text-[13px] md:h-9',
        isGenerating || !hasPreviousConversation
          ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed opacity-60'
          : 'bg-input-bg text-text border-input-border cursor-pointer hover:bg-button-hover hover:text-white hover:border-button-bg hover:shadow-[0_2px_8px_rgba(121,180,166,0.2)]',
      ]"
      :title="t('switchPreviousConversationTitle', '切换到上一次的历史对话')"
      @click="!(isGenerating || !hasPreviousConversation) && $emit('switchPrevious')"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        class="md:w-3.5 md:h-3.5"
      >
        <path d="M15 18l-6-6 6-6" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      <span class="hidden sm:inline">{{ t('previousConversation', '上一个对话') }}</span>
    </button>

    <!-- Todo 任务助手按钮 -->
    <button
      :disabled="isGenerating || isGeneratingPrompt"
      :class="[
        'px-4 py-2.5 text-sm border rounded-lg flex items-center gap-2 transition-all duration-200 h-10 md:px-3 md:py-2 md:text-[13px] md:h-9',
        isGenerating || isGeneratingPrompt
          ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed opacity-60'
          : isTodoAssistantActive
            ? 'bg-button-bg text-white border-button-bg shadow-[0_2px_8px_rgba(121,180,166,0.3)]'
            : 'bg-input-bg text-text border-input-border cursor-pointer hover:bg-button-hover hover:text-white hover:border-button-bg hover:shadow-[0_2px_8px_rgba(121,180,166,0.2)]',
      ]"
      :title="getButtonTitle()"
      @click="handleTodoAssistant"
    >
      <svg
        v-if="isGeneratingPrompt"
        class="w-4 h-4 animate-spin md:w-3.5 md:h-3.5"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          class="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          stroke-width="4"
        ></circle>
        <path
          class="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        ></path>
      </svg>
      <!-- 现代化的 AI 助手图标 -->
      <svg
        v-else
        class="w-4 h-4 md:w-3.5 md:h-3.5"
        :class="isTodoAssistantActive ? 'text-white' : 'text-current'"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="1.5"
      >
        <!-- 智能芯片/处理器图标 -->
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
        <!-- 添加一些表示智能的装饰线条 -->
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6" opacity="0.5" />
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 8h2" opacity="0.3" />
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 16h4" opacity="0.3" />
      </svg>
      <span class="hidden sm:inline">{{
        isGeneratingPrompt
          ? t('generating')
          : isTodoAssistantActive
            ? t('todoAssistantActive')
            : t('todoAssistant')
      }}</span>
    </button>

    <button
      class="px-3 py-2.5 text-sm bg-input-bg text-text border border-input-border rounded-lg cursor-pointer flex items-center justify-center transition-all duration-200 h-10 w-10 hover:bg-button-hover hover:text-white hover:border-button-bg hover:shadow-[0_2px_8px_rgba(121,180,166,0.2)] md:py-2 md:h-9 md:w-9"
      @click="$emit('toggleDrawer')"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="currentColor"
        class="md:w-3.5 md:h-3.5"
      >
        <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
import { useTodoSystemPrompt } from '@/composables/useSmartQuestion'
import { useTodos } from '@/composables/useTodos'
import { useI18n } from 'vue-i18n'
import { computed } from 'vue'
import { aiThinkingMode, saveAIThinkingMode } from '@/services/configService'

defineProps<{
  isGenerating?: boolean
  hasPreviousConversation?: boolean
  // 当当前会话尚未包含任何消息时置灰新建对话按钮
  isEmptyConversation?: boolean
  webSearchEnabled?: boolean
}>()

defineEmits<{
  (e: 'new'): void
  (e: 'toggleDrawer'): void
  (e: 'switchPrevious'): void
  (e: 'toggleWebSearch'): void
}>()

const { t } = useI18n()
const { todos } = useTodos()
const {
  isGenerating: isGeneratingPrompt,
  generateAndActivateTodoPrompt,
  deactivateTodoPrompt,
  isTodoPromptActive: isTodoAssistantActive,
} = useTodoSystemPrompt()

/**
 * 处理 Todo 任务助手按钮点击
 */
const handleTodoAssistant = async () => {
  try {
    if (isTodoAssistantActive.value) {
      // 如果已激活，则停用
      await deactivateTodoPrompt()
    } else {
      // 如果未激活，则激活
      await generateAndActivateTodoPrompt(todos.value)
    }
  } catch (error) {
    console.error('Todo 任务助手操作失败:', error)
  }
}

/**
 * 获取按钮标题
 */
const getButtonTitle = (): string => {
  if (isGeneratingPrompt.value) {
    return t('generating')
  }
  return isTodoAssistantActive.value
    ? t('todoAssistantActiveTitle', '点击停用 Todo 任务助手')
    : t('todoAssistantTitle', '点击激活 Todo 任务助手,AI 将了解您的所有任务信息')
}

// AI 思考模式开关逻辑
const thinkingEnabled = computed(() => aiThinkingMode.value === 'enabled')

const toggleThinkingMode = (event: Event) => {
  const checked = (event.target as HTMLInputElement).checked
  const mode = checked ? 'enabled' : 'disabled'
  saveAIThinkingMode(mode)
}
</script>

<style scoped>
/* AI 思考模式开关样式 */
.thinking-mode-toggle-wrapper {
  @apply flex items-center flex-shrink-0;
}

.thinking-mode-toggle {
  @apply flex items-center gap-1.5 cursor-pointer select-none relative h-10 md:h-9;
  transition: all 0.2s ease;
}

.thinking-checkbox {
  @apply absolute opacity-0 w-0 h-0;
}

.thinking-toggle-slider {
  @apply relative inline-block w-10 h-5 rounded-full transition-all duration-300;
  background: var(--input-border-color);
  flex-shrink: 0;
}

.thinking-toggle-slider::before {
  content: '';
  @apply absolute h-4 w-4 left-0.5 bottom-0.5 bg-white rounded-full transition-all duration-300;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.thinking-checkbox:checked + .thinking-toggle-slider {
  background: var(--primary-color);
}

.thinking-checkbox:checked + .thinking-toggle-slider::before {
  transform: translateX(1.25rem);
}

.thinking-icon {
  @apply w-4 h-4 flex-shrink-0 md:w-3.5 md:h-3.5;
  color: var(--primary-color);
  pointer-events: none;
}

.thinking-mode-toggle:hover .thinking-icon {
  filter: brightness(1.2);
}

/* 移动端优化样式 */
@media (max-width: 639px) {
  .flex {
    gap: 0.25rem !important;
  }

  /* 缩小新对话按钮 */
  button:nth-child(1) {
    padding: 0.25rem 0.5rem !important;
    height: 1.75rem !important;
    font-size: 0.7rem !important;
    min-width: auto !important;
    gap: 0.25rem !important;
  }

  button:nth-child(1) svg {
    width: 0.75rem !important;
    height: 0.75rem !important;
  }

  /* AI 思考模式开关 - 移动端（现在是第2个元素） */
  .thinking-mode-toggle-wrapper {
    @apply flex-shrink-0;
  }

  .thinking-mode-toggle {
    @apply gap-1 h-7;
  }

  .thinking-toggle-slider {
    @apply w-8 h-4;
  }

  .thinking-toggle-slider::before {
    @apply h-3 w-3;
  }

  .thinking-checkbox:checked + .thinking-toggle-slider::before {
    transform: translateX(1rem);
  }

  .thinking-icon {
    @apply w-3 h-3;
  }

  /* 网络搜索按钮（现在是第3个按钮） */
  button:nth-child(3) {
    padding: 0.25rem !important;
    height: 1.75rem !important;
    width: 1.75rem !important;
  }

  button:nth-child(3) svg {
    width: 0.75rem !important;
    height: 0.75rem !important;
  }

  /* 缩小上一条对话按钮 */
  button:nth-child(4) {
    padding: 0.25rem 0.5rem !important;
    height: 1.75rem !important;
    font-size: 0.7rem !important;
    min-width: auto !important;
    gap: 0.25rem !important;
  }

  button:nth-child(4) svg {
    width: 0.75rem !important;
    height: 0.75rem !important;
  }

  /* 缩小 Todo 助手按钮 */
  button:nth-child(5) {
    padding: 0.25rem 0.5rem !important;
    height: 1.75rem !important;
    font-size: 0.7rem !important;
    min-width: auto !important;
    gap: 0.25rem !important;
  }

  button:nth-child(5) svg {
    width: 0.75rem !important;
    height: 0.75rem !important;
  }

  /* 缩小历史记录按钮 */
  button:last-child {
    padding: 0.25rem !important;
    height: 1.75rem !important;
    width: 1.75rem !important;
  }

  button:last-child svg {
    width: 0.75rem !important;
    height: 0.75rem !important;
  }
}
</style>
