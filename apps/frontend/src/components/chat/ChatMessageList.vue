<template>
  <div
    ref="chatScrollContainerRef"
    class="chat-scroll-container flex-grow overflow-y-auto mb-4 flex flex-col px-6 py-6 md:px-4 md:py-4 gap-6 md:gap-4"
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
        :default-expanded="false"
      />
      <!-- 消息内容 -->
      <ChatMessage
        :ref="(el) => setChatMessageRef(el, index)"
        :message="message"
        :message-index="index"
        :is-retrying="
          message.role === 'assistant' && index === sanitizedMessages.length - 1
            ? props.isRetrying
            : false
        "
        :retry-count="
          message.role === 'assistant' && index === sanitizedMessages.length - 1
            ? props.retryCount
            : 0
        "
        :has-error="
          message.role === 'assistant' && index === sanitizedMessages.length - 1
            ? props.hasError
            : false
        "
        :is-regenerating="props.isRegenerating && message.role === 'user'"
        @copy="copyToClipboard"
        @copy-success="handleCopySuccess"
        @copy-error="handleCopyError"
        @retry="handleRetry"
        @generate-chart="handleGenerateChart"
        @check-errors="handleCheckErrors"
        @edit-message="handleEditMessage"
      />
    </div>
    <!-- AI 助手正在准备回复的 loading 状态 -->
    <!-- <div
      v-if="props.isGenerating && !props.currentResponse && !props.currentThinking"
      class="message-group"
    >
      <LoadingIndicator />
    </div> -->
    <!-- 当前流式响应 -->
    <div v-if="props.currentResponse || props.currentThinking" class="message-group">
      <!-- 思考内容组件 -->
      <ThinkingContent
        v-if="props.currentThinking"
        :content="props.currentThinking"
        :default-expanded="true"
        :auto-collapse="true"
        :ai-response-started="!!props.currentResponse"
      />
      <!-- 响应内容 -->
      <ChatMessage
        v-if="props.currentResponse"
        :message="{
          role: 'assistant',
          content: props.currentResponse,
          sanitizedContent: currentResponseSanitized,
        }"
        :is-streaming="true"
        @copy="copyToClipboard"
        @copy-success="handleCopySuccess"
        @copy-error="handleCopyError"
        @generate-chart="handleGenerateChart"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useMarkdown } from '../../composables/useMarkdown'
import type { ChatMessage as ChatMessageType } from '../../services/types'
import ChatMessage from './ChatMessage.vue'
import ThinkingContent from './ThinkingContent.vue'

const props = defineProps<{
  messages: ChatMessageType[]
  currentResponse: string
  currentThinking?: string
  isGenerating?: boolean
  isRetrying?: boolean
  retryCount?: number
  hasError?: boolean
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

// ChatMessage 组件引用管理
const chatMessageRefs = ref<Map<number, InstanceType<typeof ChatMessage>>>(new Map())

// 模板 ref 回调会传入 Element | ComponentPublicInstance | null 的联合类型。
// 这里通过是否存在 resetEditState 方法来收窄为 ChatMessage 组件实例，再进行存储；否则删除引用。
const setChatMessageRef = (el: unknown, index: number) => {
  if (
    el &&
    typeof el === 'object' &&
    'resetEditState' in el &&
    typeof (el as { resetEditState?: unknown }).resetEditState === 'function'
  ) {
    chatMessageRefs.value.set(index, el as InstanceType<typeof ChatMessage>)
  } else {
    chatMessageRefs.value.delete(index)
  }
}

// 重置所有消息的编辑状态
const resetAllEditStates = () => {
  chatMessageRefs.value.forEach((chatMessageRef) => {
    if (chatMessageRef && typeof chatMessageRef.resetEditState === 'function') {
      chatMessageRef.resetEditState()
    }
  })
}

// 扩展消息类型以包含思考内容
type ExtendedMessage = ChatMessageType & {
  sanitizedContent: string
  thinkingContent?: string
}

// 处理消息，提取思考内容（异步版本）
const sanitizedMessages = ref<ExtendedMessage[]>([])
const currentResponseSanitized = ref('')
const chatScrollContainerRef = ref<HTMLElement | null>(null)

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

// 异步处理消息内容
const processSanitizedMessages = async () => {
  // 在开始处理整个消息列表前，清空一次 Mermaid Map
  getMermaidSvgMap().clear()

  // 使用 Promise.all 并行处理所有消息的渲染，提高效率
  const processingPromises = props.messages.map(async (message) => {
    const { thinking, response } = extractThinkingContent(message.content)
    try {
      const sanitized = await renderMarkdown(response)
      return {
        ...message,
        content: response,
        thinkingContent: thinking,
        sanitizedContent: sanitized,
      }
    } catch (err) {
      console.warn('Markdown 渲染失败，使用原始内容作为回退:', err)
      return {
        ...message,
        content: response,
        thinkingContent: thinking,
        sanitizedContent: response,
      }
    }
  })

  // 等待所有消息都处理完毕
  const newSanitizedMessages = await Promise.all(processingPromises)

  sanitizedMessages.value = newSanitizedMessages
  // 所有消息的 HTML（包括占位符）都已生成，现在可以安全地注入 SVG
  scheduleMermaidInjection()
  // 列表完成更新后，滚动到底部，避免消息完成时视图跳动
  scheduleScrollToBottom()
}

// 异步处理当前响应
const processCurrentResponse = async () => {
  // 为当前响应的渲染也清空一次 map，避免和历史消息冲突
  getMermaidSvgMap().clear()
  try {
    currentResponseSanitized.value = await renderMarkdown(props.currentResponse)
  } catch (err) {
    console.warn('当前响应 Markdown 渲染失败，使用原始内容作为回退:', err)
    currentResponseSanitized.value = props.currentResponse
  }
  scheduleMermaidInjection()
  // 流式更新时也保持滚动到底部
  scheduleScrollToBottom()
}

// 监听消息变化
watch(
  () => props.messages,
  async (newMessages, oldMessages) => {
    // 在高频消息更新时，使用 rAF 调度渲染，降低布局抖动风险
    requestAnimationFrame(() => {
      processSanitizedMessages()
    })

    // 当消息数组发生变化时（通常是切换对话），重置所有编辑状态
    if (newMessages !== oldMessages) {
      nextTick(() => {
        resetAllEditStates()
      })
    }
  },
  { immediate: true, deep: true }
)

watch(() => props.currentResponse, processCurrentResponse, { immediate: true })

// 简单的滚动到底部调度，避免频繁直接操作引起抖动
let scrollRaf: number | null = null
const scheduleScrollToBottom = () => {
  if (scrollRaf !== null) {
    cancelAnimationFrame(scrollRaf)
  }
  scrollRaf = requestAnimationFrame(() => {
    try {
      const el = chatScrollContainerRef.value
      if (el) {
        el.scrollTop = el.scrollHeight
      }
    } finally {
      scrollRaf = null
    }
  })
}

const copyToClipboard = async (text: string) => {
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text)
    } else {
      // 回退方案：创建不可见 textarea 并执行复制（在部分环境下有效）
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      textarea.style.pointerEvents = 'none'
      document.body.appendChild(textarea)
      textarea.select()
      try {
        document.execCommand('copy')
      } finally {
        document.body.removeChild(textarea)
      }
    }
  } catch (err) {
    console.error('复制失败:', err)
  }
}

const handleCopySuccess = (_text: string) => {
  // 复制成功处理
  // 可以在这里添加全局通知或其他成功反馈
}

const handleCopyError = (error: Error) => {
  console.error('复制失败:', error)
  // 可以在这里添加全局错误通知
}

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
})

// 组件卸载时的清理
onBeforeUnmount(() => {
  try {
    getMermaidSvgMap().clear()
  } catch (err) {
    console.warn('清除 Mermaid SVG Map 失败:', err)
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
</style>
