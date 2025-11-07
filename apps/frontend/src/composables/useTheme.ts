import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { ThemeValue } from '../types/theme'
import { configurePWAThemeColor } from '../utils/pwa-config'
import { useUserPreferences } from './useUserPreferences'

/**
 * 统一管理主题的单例状态，避免在多个组件中调用 useTheme 产生互相覆盖的副作用。
 */

// 全局（单例）状态
const localTheme = ref<ThemeValue>((localStorage.getItem('theme') as ThemeValue) || 'auto')
const systemTheme = ref<'light' | 'dark'>(getSystemTheme())
const pendingSyncTheme = ref<ThemeValue | null>(null)

// 挂载计数与监听器初始化标记
let mountCount = 0
let watchersInitialized = false
let initializedFromLocalStorage = false
let mediaQuery: MediaQueryList | null = null

function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyThemeToDOM() {
  const current = localTheme.value === 'auto' ? systemTheme.value : localTheme.value
  document.documentElement.setAttribute('data-theme', current)
  try {
    configurePWAThemeColor()
  } catch (error) {
    console.warn('Failed to update PWA theme color:', error)
  }
}

export function useTheme() {
  const { preferences, updatePreferences, isReady } = useUserPreferences()

  // 首次调用时从 localStorage 重新同步，解决测试或运行时在导入后才写入的场景
  if (!initializedFromLocalStorage) {
    const stored = localStorage.getItem('theme') as ThemeValue | null
    if (stored) {
      localTheme.value = stored
    }
    // 同步一次系统主题，避免在测试中替换 matchMedia 后取到旧值
    systemTheme.value = getSystemTheme()
    initializedFromLocalStorage = true
  }

  // 暴露的主题值，直接以单例的 localTheme 为准
  const theme = computed<ThemeValue>({
    get: () => {
      // 当本地主题为 auto 时，允许以 localStorage 的值为后备以适配测试与未登录场景
      if (localTheme.value === 'auto') {
        return (localStorage.getItem('theme') as ThemeValue) || 'auto'
      }
      return localTheme.value
    },
    set: async (newTheme: ThemeValue) => {
      // 更新本地与存储
      localTheme.value = newTheme
      localStorage.setItem('theme', newTheme)

      // 就绪则同步到服务器，否则延迟同步
      if (isReady.value) {
        try {
          await updatePreferences({ theme: newTheme })
        } catch (error) {
          console.warn('Failed to sync theme preference:', error)
        } finally {
          pendingSyncTheme.value = null
        }
      } else {
        pendingSyncTheme.value = newTheme
      }
    },
  })

  // 初始化所有只需一次的监听与副作用
  if (!watchersInitialized) {
    watchersInitialized = true

    // 用户偏好加载后，将服务器值应用到本地主题；如有本地未同步的更改，则不覆盖
    watch(
      () => preferences.value,
      (newPreferences) => {
        if (newPreferences?.theme && pendingSyncTheme.value === null) {
          localTheme.value = newPreferences.theme
          localStorage.setItem('theme', newPreferences.theme)
          applyThemeToDOM()
        }
      },
      { deep: true }
    )

    // 监听 isReady，就绪后处理延迟同步的主题变更
    watch(
      isReady,
      async (ready) => {
        if (ready && pendingSyncTheme.value) {
          try {
            await updatePreferences({ theme: pendingSyncTheme.value })
          } catch (error) {
            console.warn('Failed to sync pending theme preference:', error)
          } finally {
            pendingSyncTheme.value = null
          }
        }
      },
      { immediate: true }
    )

    // 监听主题与系统主题变化，统一更新 DOM
    watch(
      [localTheme, systemTheme],
      () => {
        applyThemeToDOM()
      },
      { immediate: true }
    )
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

  const initTheme = () => {
    applyThemeToDOM()
  }

  const handleSystemThemeChange = (e: MediaQueryListEvent) => {
    systemTheme.value = e.matches ? 'dark' : 'light'
  }

  onMounted(() => {
    mountCount += 1
    if (mountCount === 1) {
      mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      mediaQuery.addEventListener('change', handleSystemThemeChange)
      applyThemeToDOM()
    }
  })

  onUnmounted(() => {
    mountCount = Math.max(0, mountCount - 1)
    if (mountCount === 0 && mediaQuery) {
      mediaQuery.removeEventListener('change', handleSystemThemeChange)
      mediaQuery = null
    }
  })

  return {
    theme,
    systemTheme,
    toggleTheme,
    setTheme,
    initTheme,
  }
}
