import { ApiProperty } from '@nestjs/swagger'
import { IsBoolean, IsOptional, IsString } from 'class-validator'

/**
 * 主题和语言偏好设置 DTO
 */
export class ThemePreferencesDto {
  @ApiProperty({ description: '主题设置', enum: ['light', 'dark', 'auto'], example: 'light' })
  @IsOptional()
  @IsString()
  theme?: string

  @ApiProperty({ description: '语言设置', example: 'zh-CN' })
  @IsOptional()
  @IsString()
  language?: string
}

/**
 * AI 分析功能配置 DTO
 */
export class AIAnalysisConfigDto {
  @ApiProperty({ description: '优先级分析', example: true })
  @IsOptional()
  @IsBoolean()
  enablePriorityAnalysis?: boolean

  @ApiProperty({ description: '时间估算', example: true })
  @IsOptional()
  @IsBoolean()
  enableTimeEstimation?: boolean

  @ApiProperty({ description: '子任务拆分', example: true })
  @IsOptional()
  @IsBoolean()
  enableSubtaskSplitting?: boolean
}

/**
 * 简化的用户偏好设置更新 DTO
 */
export class UpdateUserPreferencesDto {
  @ApiProperty({ description: '主题和语言偏好', type: ThemePreferencesDto })
  @IsOptional()
  theme?: ThemePreferencesDto

  @ApiProperty({ description: 'AI分析功能配置', type: AIAnalysisConfigDto })
  @IsOptional()
  ai?: AIAnalysisConfigDto
}
