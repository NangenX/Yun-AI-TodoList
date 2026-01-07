import { useWindowSize } from '@vueuse/core'
import { computed } from 'vue'

export function useUIState() {
  const { width } = useWindowSize()

  const isSmallScreen = computed(() => width.value < 768)

  return {
    isSmallScreen,
  }
}
