import { nextTick, onMounted, onUnmounted, ref, type Ref } from 'vue'

interface UseSmartScrollOptions {
  scrollContainer: Ref<HTMLElement | null>
  stickToBottom?: boolean
  autoScroll?: boolean
  scrollBehavior?: ScrollBehavior
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
  const showScrollToBottomButton = ref(false)

  let lastScrollHeight = 0
  let scrollRafScheduled = false

  const isAtBottom = () => {
    const el = scrollContainer.value
    if (!el) return true
    const { scrollTop, scrollHeight, clientHeight } = el
    const offsetFromBottom = scrollHeight - scrollTop - clientHeight
    return offsetFromBottom <= atBottomThreshold
  }

  const scrollToBottom = (behavior: ScrollBehavior = scrollBehavior) => {
    const el = scrollContainer.value
    if (!el) return
    // Explicit user action uses configured behavior (smooth by default)
    el.scrollTo({
      top: el.scrollHeight,
      behavior,
    })
  }

  const scrollToBottomInstant = () => {
    const el = scrollContainer.value
    if (!el) return
    // Instant, jank‑free bottom anchoring during streaming
    el.scrollTop = el.scrollHeight
  }

  const handleScroll = () => {
    const el = scrollContainer.value
    if (!el) return

    // Throttle via rAF to avoid measuring on every scroll event
    if (scrollRafScheduled) return
    scrollRafScheduled = true
    requestAnimationFrame(() => {
      scrollRafScheduled = false
      if (isAtBottom()) {
        isSticking.value = true
        showScrollToBottomButton.value = false
      } else {
        isSticking.value = false
        // We don't enable the button here; it will be enabled when new content increases height.
      }
    })
  }

  const checkAndScroll = async (preferInstant = false) => {
    const el = scrollContainer.value
    if (!el) return

    await nextTick()

    const currentScrollHeight = el.scrollHeight
    const atBottom = isAtBottom()

    // If user is at bottom (or sticking), keep anchored while streaming
    if ((atBottom || isSticking.value) && isAutoScrolling.value) {
      if (preferInstant) {
        scrollToBottomInstant()
      } else {
        // Use 'auto' to avoid costly smooth animations during frequent updates
        el.scrollTo({ top: el.scrollHeight, behavior: 'auto' })
      }
      showScrollToBottomButton.value = false
    } else if (currentScrollHeight > lastScrollHeight) {
      // New content arrived while user is not at bottom
      showScrollToBottomButton.value = true
    }

    lastScrollHeight = currentScrollHeight
  }

  onMounted(() => {
    const el = scrollContainer.value
    if (el) {
      el.addEventListener('scroll', handleScroll, { passive: true })
      lastScrollHeight = el.scrollHeight
      if (isSticking.value) {
        // Initial anchoring without animation
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
    showScrollToBottomButton,
    scrollToBottom,
    checkAndScroll,
  }
}
