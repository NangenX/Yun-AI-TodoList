import { computed, getCurrentInstance, onMounted, onUnmounted, ref, watch } from 'vue'
import type { ThemeValue } from '../types/theme'
import { configurePWAThemeColor } from '../utils/pwa-config'
import { useUserPreferences } from './useUserPreferences'

export function useTheme() {
  const { preferences, updatePreferences, isReady } = useUserPreferences()
  // 本地主题状态，不在初始化时从 localStorage 读取，等待 preferences 加载
  const localTheme = ref<ThemeValue>('auto')
  const systemTheme = ref<'light' | 'dark'>(getSystemTheme())

  // 计算当前主题值
  const theme = computed({
    get: () => {
      // 优先使用用户偏好设置中的主题
      if (preferences.value?.theme) {
        return preferences.value.theme
      }
      // 如果偏好设置不可用，使用本地主题状态
      if (localTheme.value !== 'auto' || !isReady.value) {
        return localTheme.value
      }
      // 最后的后备方案：从 localStorage 读取或使用默认值
      return (localStorage.getItem('theme') as ThemeValue) || 'auto'
    },
    set: async (newTheme: ThemeValue) => {
      // 立即更新本地状态
      localTheme.value = newTheme
      localStorage.setItem('theme', newTheme)

      // 如果用户偏好设置系统已准备好，同步到服务器
      if (isReady.value) {
        try {
          await updatePreferences({ theme: newTheme })
        } catch (error) {
          console.warn('Failed to sync theme preference:', error)
        }
      }
    },
  })

  watch(
    () => preferences.value,
    (newPreferences) => {
      if (newPreferences?.theme) {
        localTheme.value = newPreferences.theme
        localStorage.setItem('theme', newPreferences.theme)
        updateTheme()
      }
    },
    { deep: true }
  )

  function getSystemTheme() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }

  const toggleTheme = async () => {
    const currentTheme = theme.value
    let newTheme: ThemeValue

    if (currentTheme === 'auto') {
      newTheme = 'light'
    } else if (currentTheme === 'light') {
      newTheme = 'dark'
    } else {
      newTheme = 'auto'
    }

    theme.value = newTheme
  }

  const setTheme = async (newTheme: ThemeValue) => {
    theme.value = newTheme
  }

  const updateTheme = () => {
    const currentTheme = theme.value === 'auto' ? systemTheme.value : theme.value
    document.documentElement.setAttribute('data-theme', currentTheme)

    // 更新 PWA 状态栏主题色
    try {
      configurePWAThemeColor()
    } catch (error) {
      console.warn('Failed to update PWA theme color:', error)
    }
  }

  const initTheme = () => {
    updateTheme()
  }

  // 监听主题变化并更新 DOM
  watch(
    [theme, systemTheme],
    () => {
      updateTheme()
    },
    { immediate: true }
  )

  const handleSystemThemeChange = (e: MediaQueryListEvent) => {
    systemTheme.value = e.matches ? 'dark' : 'light'
  }

  onMounted(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaQuery.addListener(handleSystemThemeChange)
    updateTheme()
  })

  // 只在组件上下文中注册生命周期钩子
  const instance = getCurrentInstance()
  if (instance) {
    onUnmounted(() => {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      mediaQuery.removeListener(handleSystemThemeChange)
    })
  }

  return {
    theme,
    systemTheme,
    toggleTheme,
    setTheme,
    initTheme,
  }
}
