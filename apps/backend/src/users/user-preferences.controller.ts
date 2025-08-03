import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import type { User, UserPreferences } from '@shared/types'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { AIAnalysisConfigDto, ThemePreferencesDto } from './dto/user-preferences.dto'
import { UserPreferencesService } from './user-preferences.service'

@ApiTags('user-preferences')
@Controller('user-preferences')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UserPreferencesController {
  constructor(private readonly userPreferencesService: UserPreferencesService) {}

  @Get()
  @ApiOperation({ summary: '获取用户偏好设置' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getPreferences(@CurrentUser() user: User): Promise<UserPreferences> {
    const preferences = await this.userPreferencesService.findByUserId(user.id)
    if (!preferences) {
      return this.userPreferencesService.createDefault(user.id)
    }
    return preferences
  }

  @Patch('theme')
  @ApiOperation({ summary: '更新主题和语言设置' })
  @ApiResponse({ status: 200, description: '更新成功' })
  async updateThemePreferences(
    @CurrentUser() user: User,
    @Body() themePrefs: ThemePreferencesDto
  ): Promise<UserPreferences> {
    return this.userPreferencesService.updateThemeAndLanguage(user.id, themePrefs)
  }

  @Patch('ai-analysis')
  @ApiOperation({ summary: '更新 AI 分析功能配置' })
  @ApiResponse({ status: 200, description: '更新成功' })
  async updateAIAnalysisConfig(
    @CurrentUser() user: User,
    @Body() aiAnalysisConfig: AIAnalysisConfigDto
  ): Promise<UserPreferences> {
    return this.userPreferencesService.updateAIAnalysisConfig(user.id, aiAnalysisConfig)
  }
}
