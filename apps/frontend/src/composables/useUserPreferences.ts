import { computed, reactive, watch } from 'vue'
import { ApiError } from '../services/api'
import {
  UserPreferencesApi,
  type UserPreferences,
  type UserPreferencesUpdateDto,
} from '../services/userPreferencesApi'
import { useAuth } from './useAuth'

/**
 * 用户偏好设置状态
 */
interface UserPreferencesState {
  preferences: UserPreferences | null
  isLoading: boolean
  isInitialized: boolean
  syncError: string | null
}

// 全局状态
const state = reactive<UserPreferencesState>({
  preferences: null,
  isLoading: false,
  isInitialized: false,
  syncError: null,
})

// 本地存储键名
const STORAGE_KEYS = {
  PREFERENCES: 'user_preferences',
} as const

/**
 * 用户偏好设置管理 composable
 */
export function useUserPreferences() {
  const { isAuthenticated } = useAuth()

  // 计算属性
  const hasPreferences = computed(() => state.preferences !== null)
  const isReady = computed(() => state.isInitialized && !state.isLoading)

  /**
   * 从本地存储加载偏好设置
   */
  const loadFromLocalStorage = (): UserPreferences | null => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.PREFERENCES)
      return stored ? JSON.parse(stored) : null
    } catch (error) {
      console.warn('Failed to load preferences from localStorage:', error)
      return null
    }
  }

  /**
   * 保存偏好设置到本地存储
   */
  const saveToLocalStorage = (preferences: UserPreferences): void => {
    try {
      localStorage.setItem(STORAGE_KEYS.PREFERENCES, JSON.stringify(preferences))
    } catch (error) {
      console.warn('Failed to save preferences to localStorage:', error)
    }
  }

  /**
   * 从服务器加载用户偏好设置
   */
  const loadFromServer = async (): Promise<UserPreferences | null> => {
    if (!isAuthenticated.value) {
      return null
    }

    try {
      state.isLoading = true
      state.syncError = null

      const preferences = await UserPreferencesApi.getUserPreferences()
      state.preferences = preferences

      console.log('Loaded preferences from server:', preferences)

      // 保存到本地存储
      saveToLocalStorage(preferences)

      // 同步语言设置到 i18n（避免循环依赖，延迟导入）
      if (preferences.language) {
        try {
          const { updateLanguageFromPreferences } = await import('../i18n/index')
          updateLanguageFromPreferences(preferences.language)
        } catch (error) {
          console.warn('Failed to sync language to i18n:', error)
        }
      }

      return preferences
    } catch (error) {
      console.error('Failed to load preferences from server:', error)
      state.syncError = error instanceof ApiError ? error.message : 'Failed to load preferences'

      // 如果服务器加载失败，尝试从本地存储加载
      const localPreferences = loadFromLocalStorage()
      if (localPreferences) {
        state.preferences = localPreferences

        // 同步本地偏好设置的语言到 i18n
        if (localPreferences.language) {
          try {
            const { updateLanguageFromPreferences } = await import('../i18n/index')
            updateLanguageFromPreferences(localPreferences.language)
          } catch (error) {
            console.warn('Failed to sync local language to i18n:', error)
          }
        }

        return localPreferences
      }

      return null
    } finally {
      state.isLoading = false
    }
  }

  /**
   * 更新用户偏好设置
   */
  const updatePreferences = async (updates: UserPreferencesUpdateDto): Promise<boolean> => {
    if (!state.preferences) {
      console.warn('No preferences loaded, cannot update')
      return false
    }

    // 立即更新本地状态
    const updatedPreferences: UserPreferences = {
      ...state.preferences,
      ...updates,
      aiAnalysisConfig: updates.aiAnalysisConfig
        ? {
            ...state.preferences.aiAnalysisConfig,
            ...updates.aiAnalysisConfig,
          }
        : state.preferences.aiAnalysisConfig,
    }

    state.preferences = updatedPreferences
    saveToLocalStorage(updatedPreferences)

    // 如果已认证，尝试同步到服务器
    if (isAuthenticated.value) {
      try {
        state.isLoading = true
        state.syncError = null

        // 转换数据格式以匹配后端期望的结构
        const serverUpdateData: Record<string, unknown> = {}

        // 处理主题和语言更新
        if (updates.theme !== undefined || updates.language !== undefined) {
          serverUpdateData.theme = {
            ...(updates.theme !== undefined && { theme: updates.theme }),
            ...(updates.language !== undefined && { language: updates.language }),
          }
        }

        // 处理 AI 分析配置更新
        if (updates.aiAnalysisConfig) {
          serverUpdateData.ai = {
            priorityAnalysis: updates.aiAnalysisConfig.enablePriorityAnalysis,
            timeEstimation: updates.aiAnalysisConfig.enableTimeEstimation,
            subtaskSplitting: updates.aiAnalysisConfig.enableSubtaskSplitting,
          }
        }

        const serverPreferences = await UserPreferencesApi.updateUserPreferences(serverUpdateData)
        state.preferences = serverPreferences
        saveToLocalStorage(serverPreferences)

        // 如果语言发生变化，同步到 i18n
        if (updates.language && serverPreferences.language) {
          try {
            const { updateLanguageFromPreferences } = await import('../i18n/index')
            updateLanguageFromPreferences(serverPreferences.language)
          } catch (error) {
            console.warn('Failed to sync updated language to i18n:', error)
          }
        }

        return true
      } catch (error) {
        console.error('Failed to sync preferences to server:', error)
        state.syncError = error instanceof ApiError ? error.message : 'Failed to sync preferences'
        return false
      } finally {
        state.isLoading = false
      }
    }

    return true
  }

  /**
   * 初始化用户偏好设置
   */
  const initialize = async (): Promise<void> => {
    if (state.isInitialized) {
      return
    }

    if (isAuthenticated.value) {
      // 已认证用户：从服务器加载，如果失败则使用本地存储
      await loadFromServer()
    } else {
      // 未认证用户：从本地存储加载
      const localPreferences = loadFromLocalStorage()
      if (localPreferences) {
        state.preferences = localPreferences
      }
    }

    state.isInitialized = true
  }

  /**
   * 强制从服务器刷新用户偏好设置
   */
  const refreshFromServer = async (): Promise<void> => {
    if (!isAuthenticated.value) {
      console.warn('User not authenticated, cannot refresh from server')
      return
    }

    // 强制从服务器重新加载，无论是否已初始化
    await loadFromServer()
  }

  /**
   * 清理用户偏好设置（用户登出时调用）
   */
  const cleanup = (): void => {
    state.preferences = null
    state.isLoading = false
    state.isInitialized = false
    state.syncError = null
  }

  // 监听认证状态变化
  watch(isAuthenticated, async (newValue, oldValue) => {
    if (newValue && !oldValue) {
      // 用户登录
      await initialize()
    } else if (!newValue && oldValue) {
      // 用户登出
      cleanup()
    }
  })

  return {
    // 状态
    preferences: computed(() => state.preferences),
    isLoading: computed(() => state.isLoading),
    isInitialized: computed(() => state.isInitialized),
    hasPreferences,
    isReady,
    syncError: computed(() => state.syncError),

    // 方法
    initialize,
    updatePreferences,
    refreshFromServer,
    cleanup,
  }
}

export default useUserPreferences
