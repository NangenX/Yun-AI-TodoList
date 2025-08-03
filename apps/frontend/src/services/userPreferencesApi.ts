import { ApiError, httpClient } from './api'

/**
 * 用户偏好设置接口
 */
export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto'
  language: 'zh' | 'en'
  aiAnalysisConfig: {
    enablePriorityAnalysis: boolean
    enableTimeEstimation: boolean
    enableSubtaskSplitting: boolean
  }
}

/**
 * 主题和语言设置更新 DTO
 */
export interface ThemeLanguageUpdateDto {
  theme?: 'light' | 'dark' | 'auto'
  language?: 'zh' | 'en'
}

/**
 * AI 分析配置更新 DTO
 */
export interface AIAnalysisConfigUpdateDto {
  enablePriorityAnalysis?: boolean
  enableTimeEstimation?: boolean
  enableSubtaskSplitting?: boolean
}

/**
 * 批量更新用户偏好设置 DTO
 */
export interface UserPreferencesUpdateDto {
  theme?: 'light' | 'dark' | 'auto'
  language?: 'zh' | 'en'
  aiAnalysisConfig?: {
    enablePriorityAnalysis?: boolean
    enableTimeEstimation?: boolean
    enableSubtaskSplitting?: boolean
  }
}

/**
 * 用户偏好设置 API 类
 */
export class UserPreferencesApi {
  /**
   * 获取用户偏好设置
   */
  static async getUserPreferences(): Promise<UserPreferences> {
    try {
      const response = await httpClient.get<UserPreferences>('/api/v1/user-preferences')
      return response
    } catch (error) {
      throw new ApiError('Failed to get user preferences', 500, 'GET_USER_PREFERENCES_ERROR', {
        originalError: error,
      })
    }
  }

  /**
   * 更新主题和语言设置
   */
  static async updateThemeLanguage(data: ThemeLanguageUpdateDto): Promise<UserPreferences> {
    try {
      const response = await httpClient.patch<UserPreferences>(
        '/api/v1/user-preferences/theme',
        data
      )
      return response
    } catch (error) {
      throw new ApiError(
        'Failed to update theme and language preferences',
        500,
        'UPDATE_THEME_LANGUAGE_ERROR',
        { originalError: error }
      )
    }
  }

  /**
   * 更新 AI 分析配置
   */
  static async updateAIAnalysisConfig(data: AIAnalysisConfigUpdateDto): Promise<UserPreferences> {
    try {
      const response = await httpClient.patch<UserPreferences>(
        '/api/v1/user-preferences/ai-analysis',
        data
      )
      return response
    } catch (error) {
      throw new ApiError(
        'Failed to update AI analysis preferences',
        500,
        'UPDATE_AI_ANALYSIS_ERROR',
        { originalError: error }
      )
    }
  }

  /**
   * 批量更新用户偏好设置
   */
  static async updateUserPreferences(data: UserPreferencesUpdateDto): Promise<UserPreferences> {
    try {
      const response = await httpClient.patch<UserPreferences>('/api/v1/users/preferences', data)
      return response
    } catch (error) {
      throw new ApiError(
        'Failed to update user preferences',
        500,
        'UPDATE_USER_PREFERENCES_ERROR',
        { originalError: error }
      )
    }
  }
}

export default UserPreferencesApi
