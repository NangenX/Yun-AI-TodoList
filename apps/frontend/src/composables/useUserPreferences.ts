import { computed, ref, watch } from 'vue'
import { ApiError } from '../services/api'
import {
  UserPreferencesApi,
  type UserPreferences,
  type UserPreferencesUpdateDto,
} from '../services/userPreferencesApi'
import { SystemPrompt } from '@shared/types'
import { useAuth } from './useAuth'

// 全局状态使用 ref
const preferences = ref<UserPreferences | null>(null)
const isLoading = ref(false)
const isInitialized = ref(false)
const syncError = ref<string | null>(null)

// 本地存储键名
const STORAGE_KEYS = {
  PREFERENCES: 'user_preferences',
} as const

// 单例标志，确保监听器只创建一次
let watchersInitialized = false

/**
 * 用户偏好设置管理 composable
 */
export function useUserPreferences() {
  const { isAuthenticated } = useAuth()

  // 计算属性
  const hasPreferences = computed(() => preferences.value !== null)
  const isReady = computed(() => isInitialized.value && !isLoading.value)

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
      isLoading.value = true
      syncError.value = null

      const serverPreferences = await UserPreferencesApi.getUserPreferences()
      preferences.value = serverPreferences

      // 保存到本地存储
      saveToLocalStorage(serverPreferences)

      // 同步语言设置到 i18n（避免循环依赖，延迟导入）
      if (serverPreferences.language) {
        try {
          const { updateLanguageFromPreferences } = await import('../i18n/index')
          updateLanguageFromPreferences(serverPreferences.language)
        } catch (error) {
          console.warn('Failed to sync language to i18n:', error)
        }
      }

      return serverPreferences
    } catch (error) {
      console.error('Failed to load preferences from server:', error)
      syncError.value = error instanceof ApiError ? error.message : 'Failed to load preferences'

      // 如果服务器加载失败，尝试从本地存储加载
      const localPreferences = loadFromLocalStorage()
      if (localPreferences) {
        preferences.value = localPreferences

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
      isLoading.value = false
    }
  }

  /**
   * 更新用户偏好设置
   */
  const updatePreferences = async (updates: UserPreferencesUpdateDto): Promise<boolean> => {
    if (!preferences.value) {
      console.warn('No preferences loaded, cannot update')
      return false
    }

    // 立即更新本地状态
    const updatedPreferences: UserPreferences = {
      ...preferences.value,
      ...updates,
      aiAnalysisConfig: updates.aiAnalysisConfig
        ? {
            ...preferences.value.aiAnalysisConfig,
            ...updates.aiAnalysisConfig,
          }
        : preferences.value.aiAnalysisConfig,
    }

    preferences.value = updatedPreferences
    saveToLocalStorage(updatedPreferences)

    // 如果已认证，尝试同步到服务器
    if (isAuthenticated.value) {
      try {
        isLoading.value = true
        syncError.value = null

        // 转换数据格式以匹配后端期望的结构
        const serverUpdateData: Record<string, unknown> = {}

        // 处理主题和语言更新
        if (updates.theme !== undefined || updates.language !== undefined) {
          serverUpdateData.theme = {
            ...(updates.theme !== undefined && { theme: updates.theme }),
          }
          if (updates.language !== undefined) {
            serverUpdateData.language = updates.language
          }
        }

        // 处理 AI 分析配置更新
        if (updates.aiAnalysisConfig) {
          serverUpdateData.ai = {
            enablePriorityAnalysis: updates.aiAnalysisConfig.enablePriorityAnalysis,
            enableTimeEstimation: updates.aiAnalysisConfig.enableTimeEstimation,
            enableSubtaskSplitting: updates.aiAnalysisConfig.enableSubtaskSplitting,
          }
        }

        const serverPreferences = await UserPreferencesApi.updateUserPreferences(serverUpdateData)
        preferences.value = serverPreferences
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
        syncError.value = error instanceof ApiError ? error.message : 'Failed to sync preferences'
        return false
      } finally {
        isLoading.value = false
      }
    }

    return true
  }

  /**
   * 初始化用户偏好设置
   */
  const initialize = async (forceRefresh = false): Promise<void> => {
    // 防止在加载过程中重复调用，但允许强制刷新
    if (isLoading.value && !forceRefresh) {
      return
    }

    // 如果已初始化且不是强制刷新，对于认证用户仍然从服务器加载最新数据
    if (isInitialized.value && !forceRefresh && isAuthenticated.value) {
      // 认证用户：总是尝试从服务器获取最新数据以确保数据同步
      await loadFromServer()
      return
    }

    // 如果已初始化且不是强制刷新，对于未认证用户直接返回
    if (isInitialized.value && !forceRefresh && !isAuthenticated.value) {
      return
    }

    isLoading.value = true

    try {
      if (isAuthenticated.value) {
        // 已认证用户：从服务器加载，如果失败则使用本地存储
        await loadFromServer()
      } else {
        // 未认证用户：从本地存储加载
        const localPreferences = loadFromLocalStorage()
        if (localPreferences) {
          preferences.value = localPreferences
        }
      }

      isInitialized.value = true
    } finally {
      isLoading.value = false
    }
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
    preferences.value = null
    isLoading.value = false
    isInitialized.value = false
    syncError.value = null
  }

  // 只在第一次调用时创建监听器
  if (!watchersInitialized) {
    watchersInitialized = true

    // 监听认证状态变化
    watch(
      isAuthenticated,
      async (newValue, oldValue) => {
        // 减少日志噪音，只在必要时输出状态变化

        // 初始化条件：用户已认证且尚未初始化且未在加载中
        // 添加额外检查：确保这是一个真正的状态变化
        if (
          newValue === true &&
          !isInitialized.value &&
          !isLoading.value &&
          (oldValue === false || (oldValue === undefined && newValue !== oldValue))
        ) {
          // 区分不同的初始化场景
          // 减少日志输出，静默初始化用户偏好设置
          await initialize()
        } else if (newValue === false && oldValue === true) {
          // 用户登出：从 true 变为 false
          cleanup()
        }
      },
      { immediate: true }
    )
  }

  /**
   * 更新用户系统提示词列表
   */
  const updateSystemPrompts = async (systemPrompts: SystemPrompt[]): Promise<void> => {
    if (!isAuthenticated.value) {
      console.warn('用户未登录，无法更新系统提示词')
      return
    }

    try {
      isLoading.value = true
      syncError.value = null

      const updatedPreferences = await UserPreferencesApi.updateSystemPrompts(systemPrompts)

      // 更新本地状态
      preferences.value = updatedPreferences

      // 同步到本地存储
      saveToLocalStorage(updatedPreferences)
    } catch (err) {
      console.error('更新系统提示词失败:', err)
      syncError.value = err instanceof ApiError ? err.message : '更新系统提示词失败'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 获取用户系统提示词列表
   */
  const getSystemPrompts = async (): Promise<SystemPrompt[]> => {
    if (!isAuthenticated.value) {
      console.warn('用户未登录，无法获取系统提示词')
      return []
    }

    try {
      return await UserPreferencesApi.getSystemPrompts()
    } catch (err) {
      console.error('获取系统提示词失败:', err)
      syncError.value = err instanceof ApiError ? err.message : '获取系统提示词失败'
      return []
    }
  }

  return {
    // 状态
    preferences: computed(() => preferences.value),
    isLoading: computed(() => isLoading.value),
    isInitialized: computed(() => isInitialized.value),
    hasPreferences,
    isReady,
    syncError: computed(() => syncError.value),

    // 方法
    initialize,
    updatePreferences,
    updateSystemPrompts,
    getSystemPrompts,
    refreshFromServer,
    cleanup,
  }
}

export default useUserPreferences
