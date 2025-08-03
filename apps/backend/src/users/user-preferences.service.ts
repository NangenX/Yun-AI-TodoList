import { Injectable, Logger } from '@nestjs/common'
import type { UserPreferences } from '@shared/types'
import { ThemeValue } from '@shared/types/user'
import { UtilsService } from '../common/services/utils.service'
import { PrismaService } from '../database/prisma.service'
import { ThemePreferencesDto, UpdateUserPreferencesDto } from './dto/user-preferences.dto'

/**
 * 用户偏好设置服务
 * 按功能分组管理用户的各种偏好设置
 */

@Injectable()
export class UserPreferencesService {
  private readonly logger = new Logger(UserPreferencesService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly utilsService: UtilsService
  ) {}

  // ==========================================
  // 基础 CRUD 操作
  // ==========================================

  /**
   * 根据用户ID查找偏好设置
   */
  async findByUserId(userId: string): Promise<UserPreferences | null> {
    try {
      this.logger.debug(`查找用户偏好设置: ${userId}`)

      const preferences = await this.prisma.userPreferences.findUnique({
        where: { userId },
      })

      if (!preferences) {
        this.logger.debug(`用户 ${userId} 的偏好设置不存在`)
        return null
      }

      return this.mapPrismaPreferencesToUserPreferences(preferences)
    } catch (error) {
      this.logger.error(`查找用户偏好设置失败: ${userId}`, error)
      throw error
    }
  }

  /**
   * 为用户创建默认偏好设置
   */
  async createDefault(userId: string): Promise<UserPreferences> {
    try {
      this.logger.debug(`为用户创建默认偏好设置: ${userId}`)

      const preferences = await this.prisma.userPreferences.create({
        data: {
          id: this.utilsService.generateId(),
          userId,
        },
      })

      this.logger.log(`成功为用户 ${userId} 创建默认偏好设置`)
      return this.mapPrismaPreferencesToUserPreferences(preferences)
    } catch (error) {
      this.logger.error(`创建默认偏好设置失败: ${userId}`, error)
      throw error
    }
  }

  /**
   * 确保用户有偏好设置（如果不存在则创建）
   */
  async ensureUserPreferences(userId: string): Promise<UserPreferences> {
    const existing = await this.findByUserId(userId)
    if (existing) {
      return existing
    }
    return this.createDefault(userId)
  }

  // ==========================================
  // 主题和语言偏好设置
  // ==========================================

  /**
   * 更新主题设置
   */
  async updateTheme(userId: string, theme: string): Promise<UserPreferences> {
    try {
      this.logger.debug(`更新用户主题设置: ${userId} -> ${theme}`)

      const preferences = await this.updatePreferences(userId, { theme })

      this.logger.log(`成功更新用户 ${userId} 的主题设置为 ${theme}`)
      return preferences
    } catch (error) {
      this.logger.error(`更新主题设置失败: ${userId}`, error)
      throw error
    }
  }

  /**
   * 更新语言设置
   */
  async updateLanguage(userId: string, language: string): Promise<UserPreferences> {
    try {
      this.logger.debug(`更新用户语言设置: ${userId} -> ${language}`)

      const preferences = await this.updatePreferences(userId, { language })

      this.logger.log(`成功更新用户 ${userId} 的语言设置为 ${language}`)
      return preferences
    } catch (error) {
      this.logger.error(`更新语言设置失败: ${userId}`, error)
      throw error
    }
  }

  /**
   * 批量更新主题和语言设置
   */
  async updateThemeAndLanguage(
    userId: string,
    themePrefs: ThemePreferencesDto
  ): Promise<UserPreferences> {
    try {
      this.logger.debug(`批量更新用户主题和语言设置: ${userId}`, themePrefs)

      const updateData: Record<string, unknown> = {}
      if (themePrefs.theme !== undefined) updateData.theme = themePrefs.theme
      if (themePrefs.language !== undefined) updateData.language = themePrefs.language

      const preferences = await this.updatePreferences(userId, updateData)

      this.logger.log(`成功批量更新用户 ${userId} 的主题和语言设置`)
      return preferences
    } catch (error) {
      this.logger.error(`批量更新主题和语言设置失败: ${userId}`, error)
      throw error
    }
  }

  /**
   * 获取用户主题设置
   */
  async getUserTheme(userId: string): Promise<string> {
    const preferences = await this.findByUserId(userId)
    return preferences?.theme || 'light'
  }

  /**
   * 获取用户语言设置
   */
  async getUserLanguage(userId: string): Promise<string> {
    const preferences = await this.findByUserId(userId)
    return preferences?.language || 'zh-CN'
  }

  /**
   * 切换主题（在 light 和 dark 之间切换）
   */
  async toggleTheme(userId: string): Promise<UserPreferences> {
    const currentPrefs = await this.findByUserId(userId)
    const currentTheme = currentPrefs?.theme || 'light'
    const newTheme = currentTheme === 'light' ? 'dark' : 'light'

    return this.updateThemeAndLanguage(userId, { theme: newTheme })
  }

  // ==========================================
  // AI 分析功能配置管理
  // ==========================================

  /**
   * 更新 AI 分析功能配置
   */
  async updateAIAnalysisConfig(
    userId: string,
    config: {
      enablePriorityAnalysis?: boolean
      enableTimeEstimation?: boolean
      enableSubtaskSplitting?: boolean
    }
  ): Promise<UserPreferences> {
    try {
      this.logger.debug(`更新用户 AI 分析配置: ${userId}`, config)

      const updateData: Record<string, unknown> = {}
      if (config.enablePriorityAnalysis !== undefined)
        updateData.enablePriorityAnalysis = config.enablePriorityAnalysis
      if (config.enableTimeEstimation !== undefined)
        updateData.enableTimeEstimation = config.enableTimeEstimation
      if (config.enableSubtaskSplitting !== undefined)
        updateData.enableSubtaskSplitting = config.enableSubtaskSplitting

      const preferences = await this.updatePreferences(userId, updateData)

      this.logger.log(`成功更新用户 ${userId} 的 AI 分析配置`)
      return preferences
    } catch (error) {
      this.logger.error(`更新 AI 分析配置失败: ${userId}`, error)
      throw error
    }
  }

  // ==========================================
  // 批量更新方法
  // ==========================================

  /**
   * 批量更新用户偏好设置
   */
  async updateBulkPreferences(
    userId: string,
    updateDto: UpdateUserPreferencesDto
  ): Promise<UserPreferences> {
    try {
      this.logger.debug(`批量更新用户偏好设置: ${userId}`, updateDto)

      // 分别处理各个配置模块
      let preferences = await this.ensureUserPreferences(userId)

      if (updateDto.theme) {
        preferences = await this.updateThemeAndLanguage(userId, updateDto.theme)
      }

      if (updateDto.ai) {
        preferences = await this.updateAIAnalysisConfig(userId, {
          enablePriorityAnalysis: updateDto.ai.enablePriorityAnalysis,
          enableTimeEstimation: updateDto.ai.enableTimeEstimation,
          enableSubtaskSplitting: updateDto.ai.enableSubtaskSplitting,
        })
      }

      this.logger.log(`成功批量更新用户 ${userId} 的偏好设置`)
      return preferences
    } catch (error) {
      this.logger.error(`批量更新偏好设置失败: ${userId}`, error)
      throw error
    }
  }

  // ==========================================
  // 核心更新方法
  // ==========================================

  /**
   * 核心的偏好设置更新方法
   */
  private async updatePreferences(
    userId: string,
    updateData: Record<string, unknown>
  ): Promise<UserPreferences> {
    const preferences = await this.prisma.userPreferences.upsert({
      where: { userId },
      update: {
        ...updateData,
        updatedAt: new Date(),
      },
      create: {
        id: this.utilsService.generateId(),
        userId,
        ...updateData,
      },
    })

    return this.mapPrismaPreferencesToUserPreferences(preferences)
  }

  private mapPrismaPreferencesToUserPreferences(
    prismaPrefs: Record<string, unknown>
  ): UserPreferences {
    const language = prismaPrefs.language as string
    return {
      theme: (prismaPrefs.theme as ThemeValue) || 'light',
      language: (language === 'en' ? 'en' : 'zh') as 'zh' | 'en',
      aiAnalysisConfig: {
        enablePriorityAnalysis: (prismaPrefs.enablePriorityAnalysis as boolean) ?? true,
        enableTimeEstimation: (prismaPrefs.enableTimeEstimation as boolean) ?? true,
        enableSubtaskSplitting: (prismaPrefs.enableSubtaskSplitting as boolean) ?? true,
      },
    }
  }
}
