export interface AIStreamResponse {
  choices: Array<{
    delta: {
      content?: string
      reasoning_content?: string
    }
  }>
}

export interface Message {
  role: 'user' | 'system' | 'assistant'
  content: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  fileInfo?: {
    fileName: string
    fileContent: string
  }
}

export interface Conversation {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: number
  lastUpdated: string
  summary?: string
  messageCount?: number
  wordCount?: number
}

export type AIModel = 'deepseek-chat' | 'deepseek-reasoner'

export interface ModelOption {
  value: AIModel
  label: string
  description: string
}

// 系统提示词相关类型定义
export interface SystemPrompt {
  id: string
  name: string
  content: string
  isActive: boolean
  isDefault?: boolean
  createdAt: string
  updatedAt: string
}

export interface SystemPromptConfig {
  enabled: boolean
  activePromptId: string | null
}

export interface SystemPromptCreateInput {
  name: string
  content: string
}

export interface SystemPromptUpdateInput {
  name?: string
  content?: string
  isActive?: boolean
}
