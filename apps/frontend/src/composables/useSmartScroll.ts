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
    el.scrollTo({
      top: el.scrollHeight,
      behavior,
    })
  }

  const scrollToBottomInstant = () => {
    const el = scrollContainer.value
    if (!el) return
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
      } else {
        isSticking.value = false
      }
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
