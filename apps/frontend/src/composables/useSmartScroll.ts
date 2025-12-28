import { nextTick, onMounted, onUnmounted, ref, type Ref } from 'vue'

type ScrollBehaviorOption = 'auto' | 'smooth'

interface UseSmartScrollOptions {
  scrollContainer: Ref<HTMLElement | null>
  stickToBottom?: boolean
  autoScroll?: boolean
  scrollBehavior?: ScrollBehaviorOption
  atBottomThreshold?: number
}

export function useSmartScroll(options: UseSmartScrollOptions) {
  const {
    scrollContainer,
    stickToBottom: initialStickToBottom = true,
    autoScroll: initialAutoScroll = true,
    scrollBehavior = 'smooth',
    atBottomThreshold = 24,
  } = options

  const isSticking = ref(initialStickToBottom)
  const isAutoScrolling = ref(initialAutoScroll)

  let scrollRafScheduled = false
  let lastScrollTop = 0
  let isProgrammaticScroll = false

  const isAtBottom = () => {
    const el = scrollContainer.value
    if (!el) return true
    const { scrollTop, scrollHeight, clientHeight } = el
    const offsetFromBottom = scrollHeight - scrollTop - clientHeight
    return offsetFromBottom <= atBottomThreshold
  }

  const scrollToBottom = (behavior: ScrollBehaviorOption = scrollBehavior) => {
    const el = scrollContainer.value
    if (!el) return
    isProgrammaticScroll = true
    el.scrollTo({
      top: el.scrollHeight,
      behavior,
    })
    // 重置标志，允许后续检测用户滚动
    requestAnimationFrame(() => {
      isProgrammaticScroll = false
    })
  }

  const scrollToBottomInstant = () => {
    const el = scrollContainer.value
    if (!el) return
    isProgrammaticScroll = true
    el.scrollTop = el.scrollHeight
    // 重置标志，允许后续检测用户滚动
    requestAnimationFrame(() => {
      isProgrammaticScroll = false
    })
  }

  const handleScroll = () => {
    const el = scrollContainer.value
    if (!el) return

    // 如果是程序化滚动，不处理
    if (isProgrammaticScroll) return

    // Throttle via rAF to avoid measuring on every scroll event
    if (scrollRafScheduled) return
    scrollRafScheduled = true
    requestAnimationFrame(() => {
      scrollRafScheduled = false

      const currentScrollTop = el.scrollTop
      const isScrollingUp = currentScrollTop < lastScrollTop

      // 如果用户向上滚动，禁用自动滚动
      if (isScrollingUp && !isAtBottom()) {
        isAutoScrolling.value = false
      }

      // 更新 isSticking 状态
      if (isAtBottom()) {
        isSticking.value = true
        // 当用户滚动到底部时，重新启用自动滚动
        isAutoScrolling.value = true
      } else {
        isSticking.value = false
      }

      lastScrollTop = currentScrollTop
    })
  }

  const checkAndScroll = async (preferInstant = false) => {
    const el = scrollContainer.value
    if (!el) return

    await nextTick()

    const atBottom = isAtBottom()

    if ((atBottom || isSticking.value) && isAutoScrolling.value) {
      if (preferInstant) {
        scrollToBottomInstant()
      } else {
        el.scrollTo({ top: el.scrollHeight, behavior: 'auto' })
      }
    }
  }

  onMounted(() => {
    const el = scrollContainer.value
    if (el) {
      el.addEventListener('scroll', handleScroll, { passive: true })
      lastScrollTop = el.scrollTop
      if (isSticking.value) {
        scrollToBottomInstant()
      }
    }
  })

  onUnmounted(() => {
    const el = scrollContainer.value
    if (el) {
      el.removeEventListener('scroll', handleScroll)
    }
  })

  return {
    scrollToBottom,
    checkAndScroll,
  }
}
