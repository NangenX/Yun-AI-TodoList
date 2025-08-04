import { Injectable, UnauthorizedException } from '@nestjs/common'
import type { CreateUserDto, UpdateUserDto, User } from '@shared/types'
import { UtilsService } from '../common/services/utils.service'
import { PrismaService } from '../database/prisma.service'
import { ThemeValue } from '@shared/types/user'
import { ChangePasswordDto } from './dto/change-password.dto'
import { UserPreferencesService } from './user-preferences.service'

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly utilsService: UtilsService,
    private readonly userPreferencesService: UserPreferencesService
  ) {}

  async create(
    createUserDto: CreateUserDto & { emailVerified?: boolean; googleId?: string; githubId?: string }
  ): Promise<User> {
    try {
      const prismaUser = await this.prisma.user.create({
        data: {
          email: createUserDto.email,
          username: createUserDto.username,
          password: createUserDto.password,
          emailVerified: createUserDto.emailVerified ?? false,
          accountStatus: 'active',
        },
        include: {
          preferences: true,
        },
      })

      return this.mapPrismaUserToUser(
        prismaUser as Record<string, unknown> & { preferences?: Record<string, unknown> | null }
      )
    } catch (error) {
      throw new Error(
        `Failed to create user: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  async findById(id: string): Promise<User | null> {
    try {
      const prismaUser = await this.prisma.user.findUnique({
        where: { id },
        include: {
          preferences: true,
        },
      })

      return prismaUser
        ? this.mapPrismaUserToUser(
            prismaUser as Record<string, unknown> & { preferences?: Record<string, unknown> | null }
          )
        : null
    } catch {
      return null
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    try {
      const prismaUser = await this.prisma.user.findUnique({
        where: { email },
        include: {
          preferences: true,
        },
      })

      return prismaUser
        ? this.mapPrismaUserToUser(
            prismaUser as Record<string, unknown> & { preferences?: Record<string, unknown> | null }
          )
        : null
    } catch {
      return null
    }
  }

  async findByUsername(username: string): Promise<User | null> {
    try {
      const prismaUser = await this.prisma.user.findUnique({
        where: { username },
        include: {
          preferences: true,
        },
      })

      return prismaUser
        ? this.mapPrismaUserToUser(
            prismaUser as Record<string, unknown> & { preferences?: Record<string, unknown> | null }
          )
        : null
    } catch {
      return null
    }
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    try {
      // 分离 preferences 和其他字段
      const { preferences, ...userData } = updateUserDto

      // 更新用户基本信息
      const prismaUser = await this.prisma.user.update({
        where: { id },
        data: userData,
        include: {
          preferences: true,
        },
      })

      // 如果有偏好设置更新，使用 UserPreferencesService 处理
      if (preferences) {
        await this.updateUserPreferences(id, preferences)
        // 重新获取更新后的用户数据
        const updatedUser = await this.prisma.user.findUnique({
          where: { id },
          include: {
            preferences: true,
          },
        })
        if (updatedUser) {
          return this.mapPrismaUserToUser(
            updatedUser as Record<string, unknown> & {
              preferences?: Record<string, unknown> | null
            }
          )
        }
      }

      return this.mapPrismaUserToUser(
        prismaUser as Record<string, unknown> & { preferences?: Record<string, unknown> | null }
      )
    } catch (error) {
      throw new Error(
        `Failed to update user: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * 更新用户偏好设置
   */
  private async updateUserPreferences(userId: string, preferences: Partial<any>): Promise<void> {
    // 处理主题和语言设置
    if (preferences.theme || preferences.language) {
      await this.userPreferencesService.updateThemeAndLanguage(userId, {
        theme: preferences.theme,
        language: preferences.language,
      })
    }

    // 处理 AI 分析配置
    if (preferences.aiAnalysisConfig) {
      await this.userPreferencesService.updateAIAnalysisConfig(userId, {
        enablePriorityAnalysis: preferences.aiAnalysisConfig.enablePriorityAnalysis,
        enableTimeEstimation: preferences.aiAnalysisConfig.enableTimeEstimation,
        enableSubtaskSplitting: preferences.aiAnalysisConfig.enableSubtaskSplitting,
      })
    }

    // 处理系统提示词
    if (preferences.systemPrompts !== undefined) {
      await this.userPreferencesService.updateSystemPrompts(userId, preferences.systemPrompts)
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.prisma.user.delete({
        where: { id },
      })
    } catch (error) {
      throw new Error(
        `Failed to delete user: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  async updateLastActiveTime(id: string): Promise<void> {
    try {
      await this.prisma.user.update({
        where: { id },
        data: {
          lastActiveAt: new Date(),
        },
      })
    } catch {
      // 不抛出错误，因为这不是关键操作
    }
  }

  private mapPrismaUserToUser(
    prismaUser: Record<string, unknown> & { preferences?: Record<string, unknown> | null }
  ): User {
    const prefs = prismaUser.preferences || {}

    // 处理 systemPrompts JSON 字段
    let systemPrompts: any[] = []
    if (prefs.systemPrompts) {
      try {
        const parsed = Array.isArray(prefs.systemPrompts)
          ? prefs.systemPrompts
          : JSON.parse(prefs.systemPrompts as string)
        systemPrompts = Array.isArray(parsed) ? parsed : []
      } catch (error) {
        console.warn('解析 systemPrompts 失败，使用空数组', error)
        systemPrompts = []
      }
    }

    return {
      id: prismaUser.id as string,
      email: prismaUser.email as string,
      username: prismaUser.username as string,
      avatarUrl: prismaUser.avatarUrl as string | undefined,
      emailVerified: (prismaUser.emailVerified as boolean) ?? false,
      preferences: {
        theme: (prefs.theme as ThemeValue) || 'light',
        language: ((prefs.language as string) === 'en' ? 'en' : 'zh') as 'zh' | 'en',
        aiAnalysisConfig: {
          enablePriorityAnalysis: (prefs.enablePriorityAnalysis as boolean) ?? true,
          enableTimeEstimation: (prefs.enableTimeEstimation as boolean) ?? true,
          enableSubtaskSplitting: (prefs.enableSubtaskSplitting as boolean) ?? false,
        },
        systemPrompts,
      },
      createdAt: (prismaUser.createdAt as Date).toISOString(),
      updatedAt: (prismaUser.updatedAt as Date).toISOString(),
    }
  }

  async updatePassword(userId: string, hashedPassword: string): Promise<void> {
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          password: hashedPassword,
          updatedAt: new Date(),
        },
      })
    } catch (error) {
      throw new Error(
        `Failed to update password: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto): Promise<void> {
    try {
      // 获取用户当前密码
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { password: true },
      })

      if (!user || !user.password) {
        throw new UnauthorizedException('用户不存在或密码未设置')
      }

      // 验证当前密码
      const isCurrentPasswordValid = await this.utilsService.comparePassword(
        changePasswordDto.currentPassword,
        user.password
      )

      if (!isCurrentPasswordValid) {
        throw new UnauthorizedException('当前密码错误')
      }

      // 加密新密码
      const hashedNewPassword = await this.utilsService.hashPassword(changePasswordDto.newPassword)

      // 更新密码
      await this.updatePassword(userId, hashedNewPassword)
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error
      }
      throw new Error(
        `Failed to change password: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  async findByGoogleId(_googleId: string): Promise<User | null> {
    // 暂时禁用 OAuth 功能以修复 Prisma 客户端问题
    return null
  }

  async linkGoogleAccount(_userId: string, _googleId: string, _avatarUrl?: string): Promise<User> {
    // 暂时禁用 OAuth 功能以修复 Prisma 客户端问题
    throw new Error('OAuth functionality temporarily disabled')
  }

  async findByGitHubId(_githubId: string): Promise<User | null> {
    // 暂时禁用 OAuth 功能以修复 Prisma 客户端问题
    return null
  }

  async linkGitHubAccount(_userId: string, _githubId: string, _avatarUrl?: string): Promise<User> {
    // 暂时禁用 OAuth 功能以修复 Prisma 客户端问题
    throw new Error('OAuth functionality temporarily disabled')
  }

  // 添加一个方法来处理包含密码的内部用户类型（仅用于认证服务）
  mapPrismaUserToInternalUser(
    prismaUser: Record<string, unknown> & {
      preferences?: Record<string, unknown> | null
      password?: string | null
    }
  ): Record<string, unknown> {
    const user = this.mapPrismaUserToUser(prismaUser)
    return {
      ...user,
      password: prismaUser.password,
    }
  }
}
