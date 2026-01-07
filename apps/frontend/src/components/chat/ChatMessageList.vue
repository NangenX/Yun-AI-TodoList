<template>
  <div
    ref="chatScrollContainerRef"
    class="relative chat-scroll-container flex-grow overflow-y-auto mb-4 flex flex-col px-6 py-6 md:px-4 md:py-4 gap-6 md:gap-4"
  >
    <div
      v-for="(message, index) in sanitizedMessages"
      :key="message.id || index"
      class="message-group"
    >
      <!-- 思考内容组件（仅对助手消息显示） -->
      <ThinkingContent
        v-if="message.role === 'assistant' && message.thinkingContent"
        :content="message.thinkingContent"
        :default-expanded="message.isStreaming"
        :auto-collapse="message.isStreaming"
        :ai-response-started="message.isStreaming && !!message.content"
      />
      <!-- 消息内容 -->
      <ChatMessage
        v-if="message.content && message.content.trim() !== ''"
        :message="message"
        :message-index="index"
        :is-streaming="message.isStreaming"
        :is-regenerating="props.isRegenerating && message.role === 'user'"
        @retry="handleRetry"
        @generate-chart="handleGenerateChart"
        @check-errors="handleCheckErrors"
        @edit-message="handleEditMessage"
      />
    </div>
    <!-- AI 助手正在准备回复的 loading 状态 -->
    <div
      v-if="props.isGenerating && !props.currentResponse && !props.currentThinking"
      class="message-group"
    >
      <LoadingIndicator />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useMarkdown } from '../../composables/useMarkdown'
import { useSmartScroll } from '../../composables/useSmartScroll'
import type { ChatMessage as ChatMessageType } from '../../services/types'
import ChatMessage from './ChatMessage.vue'
import LoadingIndicator from './LoadingIndicator.vue'
import ThinkingContent from './ThinkingContent.vue'

const props = defineProps<{
  messages: ChatMessageType[]
  currentResponse: string
  currentThinking?: string
  isGenerating?: boolean
  isRegenerating?: boolean
}>()

const emit = defineEmits<{
  (e: 'retry', messageIndex: number): void
  (e: 'generate-chart', content: string): void
  (e: 'check-errors', content: string): void
  (e: 'edit-message', messageIndex: number, newContent: string): void
}>()

const { renderMarkdown, getMermaidSvgMap, extractThinkingContent, setupCodeCopyFunction } =
  useMarkdown()

// 将 currentResponse 合并到消息列表中，以便统一处理
const combinedMessages = computed(() => {
  const allMessages: (ChatMessageType & { thinkingContent?: string; isStreaming?: boolean })[] = [
    ...props.messages,
  ]
  if (props.currentResponse || props.currentThinking) {
    allMessages.push({
      id: 'streaming-response',
      role: 'assistant',
      content: props.currentResponse,
      thinkingContent: props.currentThinking,
      isStreaming: true,
    })
  }
  return allMessages
})

// 扩展消息类型以包含思考内容
type ExtendedMessage = ChatMessageType & {
  sanitizedContent: string
  thinkingContent?: string
  isStreaming?: boolean
}

// 处理消息，提取思考内容（异步版本）
const sanitizedMessages = ref<ExtendedMessage[]>([])
// 缓存 Markdown 渲染结果，避免在流式更新时对整个历史消息重复渲染
const sanitizationCache = new Map<string, string>()
const chatScrollContainerRef = ref<HTMLElement | null>(null)
const {
  checkAndScroll,
  scrollToBottom,
  streamingScroll,
  setStreamingMode,
  isUserScrolledUp,
  enableAutoScroll,
} = useSmartScroll({
  scrollContainer: chatScrollContainerRef,
  atBottomThreshold: 48, // 稍微增大阈值，提高用户体验
  streamingInstant: true, // 流式更新时使用瞬时滚动
})

// 实现 Mermaid SVG 注入逻辑
const injectMermaidSVGs = async () => {
  await nextTick()
  const svgMap = getMermaidSvgMap()
  if (svgMap.size === 0) return

  svgMap.forEach((fullHtml, placeholderId) => {
    const placeholder = document.getElementById(placeholderId)
    if (placeholder && placeholder.parentNode) {
      // 创建临时容器来解析完整的HTML
      const tempWrapper = document.createElement('div')
      tempWrapper.innerHTML = fullHtml

      // 获取完整的容器元素（包含缩放按钮和SVG）
      const containerElement = tempWrapper.querySelector('.mermaid-container')
      if (containerElement) {
        // 替换占位符为完整的容器
        placeholder.parentNode.replaceChild(containerElement, placeholder)
      }
    }
  })

  svgMap.clear()
}

// 使用 requestAnimationFrame 对注入进行调度，避免在高频更新时造成布局抖动
let injectionRaf: number | null = null
const scheduleMermaidInjection = () => {
  if (injectionRaf !== null) {
    cancelAnimationFrame(injectionRaf)
  }
  injectionRaf = requestAnimationFrame(async () => {
    try {
      await injectMermaidSVGs()
    } finally {
      injectionRaf = null
    }
  })
}

// 通过串行化处理避免并发清空 Mermaid Map
let isProcessingMessages = false
let shouldReprocessMessages = false

const processSanitizedMessagesInternal = async () => {
  // 使用 Promise.all 并行处理所有消息的渲染，提高效率
  const processingPromises = combinedMessages.value.map(async (message, index) => {
    const { thinking, response } = message.isStreaming
      ? { thinking: message.thinkingContent, response: message.content }
      : extractThinkingContent(message.content)
    const cacheKey = `${message.id ?? `index:${index}`}` + `:${response}`
    let sanitized: string
    const cached = sanitizationCache.get(cacheKey)
    if (cached !== undefined) {
      sanitized = cached
    } else {
      try {
        sanitized = await renderMarkdown(response)
        sanitizationCache.set(cacheKey, sanitized)
      } catch (err) {
        console.warn('Markdown 渲染失败，使用原始内容作为回退:', err)
        sanitized = response
        // 不缓存失败的结果，以便后续有机会重新渲染
      }
    }
    return {
      ...message,
      content: response,
      thinkingContent: thinking,
      sanitizedContent: sanitized,
      isStreaming: !!message.isStreaming,
    }
  })

  // 等待所有消息都处理完毕
  const newSanitizedMessages = await Promise.all(processingPromises)

  sanitizedMessages.value = newSanitizedMessages
  // 仅保留当前消息列表对应的缓存，避免缓存无限增长
  const activeKeys = new Set<string>()
  newSanitizedMessages.forEach((msg, index) => {
    const key = `${msg.id ?? `index:${index}`}:${msg.content}`
    activeKeys.add(key)
  })
  if (sanitizationCache.size > activeKeys.size) {
    for (const key of sanitizationCache.keys()) {
      if (!activeKeys.has(key)) {
        sanitizationCache.delete(key)
      }
    }
  }
  scheduleMermaidInjection()
  const lastMsg = newSanitizedMessages[newSanitizedMessages.length - 1]
  if (!(lastMsg && lastMsg.role === 'user')) {
    // 根据是否流式更新选择不同的滚动策略
    const isStreaming = lastMsg?.isStreaming
    if (isStreaming) {
      streamingScroll()
    } else {
      checkAndScroll('content-change')
    }
  }
}

// 异步处理消息内容
const processSanitizedMessages = async () => {
  if (isProcessingMessages) {
    shouldReprocessMessages = true
    return
  }

  isProcessingMessages = true
  try {
    do {
      shouldReprocessMessages = false
      await processSanitizedMessagesInternal()
    } while (shouldReprocessMessages)
  } finally {
    isProcessingMessages = false
  }
}

// 监听消息变化
watch(
  combinedMessages,
  () => {
    // 在高频消息更新时，使用 rAF 调度渲染，降低布局抖动风险
    requestAnimationFrame(() => {
      void processSanitizedMessages()
    })
  },
  { immediate: true, deep: true }
)

// 思考内容流式更新时保持滚动到底部，确保"思考过程"可见
watch(
  () => props.currentThinking,
  (newVal) => {
    if (newVal) {
      // 思考内容流式更新时使用流式滚动，保证底部锚定
      streamingScroll()
    }
  }
)

// 监听流式响应内容变化
watch(
  () => props.currentResponse,
  (newVal) => {
    if (newVal) {
      // 响应内容流式更新时使用流式滚动
      streamingScroll()
    }
  }
)

// 监听生成状态变化，设置流式模式
watch(
  () => props.isGenerating,
  (isGenerating) => {
    setStreamingMode(!!isGenerating)
  },
  { immediate: true }
)

const handleRetry = (messageIndex: number) => {
  emit('retry', messageIndex)
}

const handleGenerateChart = (content: string) => {
  emit('generate-chart', content)
}

const handleCheckErrors = (content: string) => {
  emit('check-errors', content)
}

const handleEditMessage = (messageIndex: number, newContent: string) => {
  emit('edit-message', messageIndex, newContent)
}

onMounted(() => {
  // 设置代码复制功能
  setupCodeCopyFunction()
  // 初始时将视图锚定到底部，避免首次渲染的跳动
  requestAnimationFrame(() => {
    scrollToBottom('instant')
  })
})

// 在生成完成或重新生成完成后，触发一次 Mermaid 注入，确保占位符替换为最终 SVG 容器
watch(
  () => [props.isGenerating, props.isRegenerating],
  async ([isGen, isRegen]) => {
    if (!isGen && !isRegen) {
      await nextTick()
      scheduleMermaidInjection()
    }
  }
)

defineExpose({
  scrollToBottom,
  enableAutoScroll,
  isUserScrolledUp,
})

// 组件卸载时的清理
onBeforeUnmount(() => {
  try {
    getMermaidSvgMap().clear()
  } catch (err) {
    console.warn('清除 Mermaid SVG Map 失败:', err)
  }
  // 取消仍在排队的 SVG 注入 rAF，防止卸载后仍然尝试操作已销毁的 DOM
  if (injectionRaf !== null) {
    try {
      cancelAnimationFrame(injectionRaf)
    } catch (_err) {
      // ignore
    } finally {
      injectionRaf = null
    }
  }
})
</script>

<style scoped>
.chat-scroll-container {
  overflow-y: auto;
  flex-grow: 1;
}

.message-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.message-group + .message-group {
  margin-top: 1.5rem;
}

/* 移动端优化样式 */
@media (max-width: 639px) {
  .flex-grow {
    padding: 1rem 1rem 1rem 1rem !important;
    gap: 1rem !important;
  }

  .message-group {
    gap: 0.75rem;
  }

  .message-group + .message-group {
    margin-top: 1.25rem;
  }
}

/* 触摸设备优化 */
@media (hover: none) and (pointer: coarse) {
  .flex-grow {
    padding: 1.25rem 1rem !important;
    gap: 1.25rem !important;
  }

  .message-group {
    gap: 1rem;
  }

  .message-group + .message-group {
    margin-top: 1.5rem;
  }
}

/* 平板端适配 */
@media (min-width: 640px) and (max-width: 1024px) {
  .flex-grow {
    padding: 1.5rem 1.25rem !important;
    gap: 1.25rem !important;
  }
}

/* 全屏模式下的移动端优化 */
@media (max-width: 639px) {
  .ai-sidebar.fullscreen .flex-grow {
    padding: 1.25rem 1rem !important;
  }
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
