<template>
  <div
    ref="chatHistoryRef"
    class="chat-scroll-container flex-grow overflow-y-auto mb-4 flex flex-col px-6 py-6 md:px-4 md:py-4 gap-6 md:gap-4 bg-gradient-to-b from-white/3 to-transparent"
    @scroll="handleScroll"
  >
    <div v-for="(message, index) in sanitizedMessages" :key="index" class="message-group">
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
    <div
      v-if="props.isGenerating && !props.currentResponse && !props.currentThinking"
      class="message-group"
    >
      <LoadingIndicator />
    </div>
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
import { nextTick, onMounted, ref, watch } from 'vue'
import { useMarkdown } from '../../composables/useMarkdown'
import type { ChatMessage as ChatMessageType } from '../../services/types'
import ChatMessage from './ChatMessage.vue'
import LoadingIndicator from './LoadingIndicator.vue'
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
  (
    e: 'scroll',
    value: {
      isAtBottom: boolean
      scrollTop: number
      scrollHeight: number
      clientHeight: number
    }
  ): void
  (e: 'retry', messageIndex: number): void
  (e: 'generate-chart', content: string): void
  (e: 'check-errors', content: string): void
  (e: 'edit-message', messageIndex: number, newContent: string): void
}>()

const {
  renderMarkdown,
  getMermaidSvgMap,
  extractThinkingContent,
  setupCodeCopyFunction,
  reinitializeMermaid,
} = useMarkdown()
const chatHistoryRef = ref<HTMLDivElement | null>(null)

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
    const sanitized = await renderMarkdown(response)
    return {
      ...message,
      content: response,
      thinkingContent: thinking,
      sanitizedContent: sanitized,
    }
  })

  // 等待所有消息都处理完毕
  const newSanitizedMessages = await Promise.all(processingPromises)

  sanitizedMessages.value = newSanitizedMessages
  // 所有消息的 HTML（包括占位符）都已生成，现在可以安全地注入 SVG
  scheduleMermaidInjection()
}

// 异步处理当前响应
const processCurrentResponse = async () => {
  // 为当前响应的渲染也清空一次 map，避免和历史消息冲突
  getMermaidSvgMap().clear()
  currentResponseSanitized.value = await renderMarkdown(props.currentResponse)
  scheduleMermaidInjection()
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

// 监听当前响应变化，检测对话是否结束
watch(
  () => props.currentResponse,
  (newVal, oldVal) => {
    // 检测对话是否结束：当前响应从有内容变为空
    if (oldVal && oldVal.length > 0 && !newVal) {
      isConversationEnding.value = true
      // 设置一个定时器来重置结束状态
      setTimeout(() => {
        isConversationEnding.value = false
      }, 1000)
    }
  }
)

watch(() => props.currentResponse, processCurrentResponse, { immediate: true })

// 移除 getCurrentStreamingContent 函数，现在分别处理思考内容和响应内容

const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
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

const isUserScrolling = ref(false)
const lastScrollTop = ref(0)
const isConversationEnding = ref(false)
const lastUserScrollAt = ref(0)

// 是否偏好减少动画
const prefersReducedMotion = ref(false)

// 使用 rAF 合并滚动操作，避免频繁设置 scrollTop 导致卡顿
let scrollRafId: number | null = null

// 判断是否接近底部（阈值可微调）
const isNearBottom = (el: HTMLElement, threshold = 40) => {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= threshold
}

const scheduleScrollToBottom = (smooth = true) => {
  const element = chatHistoryRef.value
  if (!element) return

  if (scrollRafId !== null) {
    cancelAnimationFrame(scrollRafId)
  }
  scrollRafId = requestAnimationFrame(() => {
    try {
      element.scrollTo({
        top: element.scrollHeight,
        behavior: smooth && !prefersReducedMotion.value ? 'smooth' : 'auto',
      })
    } finally {
      scrollRafId = null
    }
  })
}

const scrollToBottomInstantly = () => {
  scheduleScrollToBottom(false)
}

const scrollToBottom = () => {
  scheduleScrollToBottom(true)
}

const handleScroll = () => {
  if (chatHistoryRef.value) {
    const element = chatHistoryRef.value
    const isAtBottom = element.scrollHeight - element.scrollTop <= element.clientHeight + 30

    // 检测用户滚动方向
    if (element.scrollTop < lastScrollTop.value) {
      // 向上滚动，禁用自动滚动
      isUserScrolling.value = true
      lastUserScrollAt.value = Date.now()
    } else if (element.scrollTop > lastScrollTop.value && !isAtBottom) {
      // 向下滚动但未到达底部，也表明用户有主动滚动意图
      isUserScrolling.value = true
      lastUserScrollAt.value = Date.now()
    } else if (isAtBottom) {
      // 用户滚动到底部，重新启用自动滚动
      isUserScrolling.value = false
    }

    lastScrollTop.value = element.scrollTop

    emit('scroll', {
      isAtBottom,
      scrollTop: element.scrollTop,
      scrollHeight: element.scrollHeight,
      clientHeight: element.clientHeight,
    })
  }
}

// 仅在满足自动滚动条件时滚动：用户未主动滚动、靠近底部，且最近 1s 内没有手动滚动
const shouldAutoScroll = (): boolean => {
  const element = chatHistoryRef.value
  if (!element) return false
  const timeSinceUserScroll = Date.now() - lastUserScrollAt.value
  const userIdle = timeSinceUserScroll > 1000
  return !isUserScrolling.value && isNearBottom(element) && userIdle
}

const smartScrollToBottom = () => {
  const element = chatHistoryRef.value
  if (!element) return

  // 仅当用户未主动滚动且接近底部时才进行平滑滚动，避免“拉扯感”
  if (!isUserScrolling.value && isNearBottom(element)) {
    scrollToBottom()
  }
}

onMounted(() => {
  // 检测用户系统是否偏好减少动画
  try {
    prefersReducedMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch (err) {
    console.warn('无法检测动画偏好:', err)
  }

  scrollToBottomInstantly()
  // 设置代码复制功能
  setupCodeCopyFunction()

  // 监听主题切换（通过 data-theme 属性），在切换时重新初始化 Mermaid 并重新渲染消息
  try {
    const observer = new MutationObserver(async (mutations) => {
      for (const mutation of mutations) {
        if (
          mutation.type === 'attributes' &&
          mutation.attributeName === 'data-theme' &&
          mutation.target === document.documentElement
        ) {
          // 重新初始化 Mermaid，以应用新的主题配置
          await reinitializeMermaid()
          // 重新处理消息和当前流式响应，以重新生成新的主题下的 SVG
          await processSanitizedMessages()
          if (props.currentResponse) {
            await processCurrentResponse()
          }
          break
        }
      }
    })
    observer.observe(document.documentElement, { attributes: true })
  } catch (err) {
    console.warn('无法监听主题切换:', err)
  }
})

watch(
  () => props.messages,
  (newMessages, oldMessages) => {
    // 只有在消息数量增加时才可能需要自动滚动
    if (newMessages.length > (oldMessages?.length || 0)) {
      // 检查最新添加的消息是否是用户消息
      const lastMessage = newMessages[newMessages.length - 1]
      if (lastMessage && lastMessage.role === 'user') {
        // 用户发送消息时：强制瞬间滚到底部，符合用户预期
        isUserScrolling.value = false
        nextTick(() => {
          setTimeout(() => {
            scrollToBottomInstantly()
          }, 0)
        })
      } else if (lastMessage && lastMessage.role === 'assistant') {
        // AI消息完成时：仅在满足自动滚动条件且不处于结束切换状态时滚动
        nextTick(() => {
          if (shouldAutoScroll() && !isConversationEnding.value) {
            smartScrollToBottom()
          }
        })
      }
    }
  },
  { immediate: true }
)

// 流式响应过程中的智能滚动
watch(
  () => props.currentResponse,
  (newVal, oldVal) => {
    if (newVal !== oldVal) {
      nextTick(() => {
        // 如果对话正在结束（从有内容到无内容），不执行滚动
        // 因为这会在消息列表更新时由 messages 的监听器处理
        if (!(oldVal && oldVal.length > 0 && !newVal)) {
          if (shouldAutoScroll()) {
            smartScrollToBottom()
          }
        }
      })
    }
  }
)

// 思考内容变化时的智能滚动
watch(
  () => props.currentThinking,
  (newVal, oldVal) => {
    if (newVal !== oldVal) {
      nextTick(() => {
        // 如果对话正在结束，不执行滚动；且仅在满足自动滚动条件时滚动
        if (!isConversationEnding.value && shouldAutoScroll()) {
          smartScrollToBottom()
        }
      })
    }
  }
)

defineExpose({
  scrollToBottom,
  scrollToBottomInstantly,
})
</script>

<style scoped>
.chat-scroll-container {
  scroll-behavior: smooth; /* 默认启用平滑滚动 */
  -webkit-overflow-scrolling: touch; /* iOS 系统增强 */
  overscroll-behavior-y: contain; /* 防止上拉/下拉触发浏览器回弹 */
  will-change: scroll-position; /* 提示浏览器优化滚动 */
  contain: layout paint; /* 隔离内部绘制，降低滚动重绘开销 */
  backface-visibility: hidden;
  transform: translateZ(0); /* 强制 GPU 合成，减少滚动闪烁 */
}

@media (prefers-reduced-motion: reduce) {
  .chat-scroll-container {
    scroll-behavior: auto; /* 尊重系统设置，禁用平滑滚动 */
  }
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
    background: linear-gradient(
      180deg,
      rgba(var(--bg-color-rgb), 0.02) 0%,
      transparent 100%
    ) !important;
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
    background: rgba(var(--bg-color-rgb), 0.98) !important;
  }
}
</style>

<style scoped></style>
