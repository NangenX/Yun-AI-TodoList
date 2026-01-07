import { useWindowSize } from '@vueuse/core'
import { computed, ref } from 'vue'

export function useUIState() {
  const showCharts = ref(false)
  const { width } = useWindowSize()

  const isSmallScreen = computed(() => width.value < 768)

  const toggleCharts = () => {
    showCharts.value = !showCharts.value
  }

  const closeCharts = () => {
    showCharts.value = false
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      if (showCharts.value) {
        showCharts.value = false
        return
      }
    }

    if (event.ctrlKey || event.metaKey) {
      switch (event.key.toLowerCase()) {
        case 's':
          event.preventDefault()
          toggleCharts()
          break
      }
    }
  }

  return {
    showCharts,
    isSmallScreen,
    toggleCharts,
    closeCharts,
    onKeyDown,
  }
}
