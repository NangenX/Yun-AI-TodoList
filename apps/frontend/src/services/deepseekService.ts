import i18n from '../i18n'
import { logger } from '../utils/logger'
import { getAIModel, getApiKey, getBaseUrl } from './configService'
import { AIStreamResponse, Message, SystemPrompt } from './types'

// 获取系统提示词配置
const getSystemPromptConfig = () => {
  try {
    const config = localStorage.getItem('system_prompt_config')
    if (config) {
      const parsedConfig = JSON.parse(config)
      return {
        enabled: parsedConfig.enabled || false,
        activePromptId: parsedConfig.activePromptId || null,
      }
    }
  } catch (error) {
    logger.warn('获取系统提示词配置失败', error, 'DeepSeekService')
  }
  return {
    enabled: false,
    activePromptId: null,
  }
}

// 简单的 Todo 系统提示缓存（基于 todos 的 JSON 快照）
let todoPromptCache: { hash: string; content: string } | null = null

// 获取所有激活的系统提示词消息
const getSystemMessages = async (): Promise<Message[]> => {
  const systemMessages: Message[] = []

  // 1. 获取用户自定义的系统提示词
  const config = getSystemPromptConfig()
  if (config.enabled && config.activePromptId) {
    try {
      const prompts = localStorage.getItem('system_prompts')
      if (prompts) {
        const promptList = JSON.parse(prompts)
        const activePrompt = promptList.find(
          (p: SystemPrompt) => p.id === config.activePromptId && p.isActive
        )
        if (activePrompt && activePrompt.content.trim()) {
          systemMessages.push({
            role: 'system',
            content: activePrompt.content.trim(),
          })
          logger.debug(
            '添加用户自定义系统提示词',
            {
              name: activePrompt.name,
              contentLength: activePrompt.content.length,
            },
            'DeepSeekService'
          )
        }
      }
    } catch (error) {
      logger.warn('获取用户系统提示词失败', error, 'DeepSeekService')
    }
  }

  // 2. 获取 Todo 助手的系统提示词（动态生成最新内容）
  try {
    const todoAssistantData = localStorage.getItem('todo_assistant_prompt')
    if (todoAssistantData) {
      const parsed = JSON.parse(todoAssistantData)
      if (parsed.isActive) {
        // 动态生成最新的 Todo 助手系统提示词
        // 优先从运行时状态（useTodos）读取，确保云端模式也能获取到最新数据；失败时回退到 localStorage 快照
        let todos: unknown = []
        let todosSource: 'runtime' | 'localStorage' = 'runtime'
        try {
          const { useTodos } = await import('../composables/useTodos')
          const { todos: todosRef, isInitialized } = useTodos()
          const runtimeTodos = Array.isArray(todosRef?.value) ? todosRef.value : []

          // 如果运行时已初始化或存在数据，则优先使用运行时数据
          if ((isInitialized?.value ?? false) || (runtimeTodos && runtimeTodos.length > 0)) {
            todos = runtimeTodos
          } else {
            // 回退到本地存储快照（兼容旧键名）
            todosSource = 'localStorage'
            const raw = localStorage.getItem('local_todos') ?? localStorage.getItem('todos') ?? '[]'
            const parsed = JSON.parse(raw)
            todos = Array.isArray(parsed) ? parsed : []
          }
        } catch {
          // 运行时读取失败时，继续尝试本地快照
          todosSource = 'localStorage'
          try {
            const raw = localStorage.getItem('local_todos') ?? localStorage.getItem('todos') ?? '[]'
            const parsed = JSON.parse(raw)
            todos = Array.isArray(parsed) ? parsed : []
          } catch {
            todos = []
          }
        }

        // 轻量缓存：避免重复生成相同内容
        const todosHash = (() => {
          try {
            return JSON.stringify(todos)
          } catch {
            return `${Array.isArray(todos) ? todos.length : 0}`
          }
        })()

        let freshContent = ''
        if (todoPromptCache && todoPromptCache.hash === todosHash) {
          freshContent = todoPromptCache.content
        } else {
          // 动态导入生成函数
          const { generateTodoSystemPrompt } = await import('../services/aiAnalysisService')
          freshContent = generateTodoSystemPrompt(todos as any)
          todoPromptCache = { hash: todosHash, content: freshContent }
        }

        systemMessages.push({
          role: 'system',
          content: freshContent.trim(),
        })
        logger.debug(
          '添加动态生成的 Todo 助手系统提示词',
          {
            todosCount: Array.isArray(todos) ? todos.length : 0,
            source: todosSource,
            contentLength: freshContent.length,
          },
          'DeepSeekService'
        )
      }
    }
  } catch (error) {
    logger.warn('获取/生成 Todo 助手提示词失败', error, 'DeepSeekService')
  }

  logger.debug(
    '系统消息构建完成',
    {
      totalSystemMessages: systemMessages.length,
      messages: systemMessages.map((msg) => ({
        role: msg.role,
        contentLength: msg.content.length,
      })),
    },
    'DeepSeekService'
  )

  return systemMessages
}

// 错误处理函数
function handleError(error: unknown, context: string, source: string) {
  const errorMessage = error instanceof Error ? error.message : String(error)
  logger.error(`${context}: ${errorMessage}`, error, source)
}

// 动态获取 API URL
const getApiUrl = () => {
  const baseUrl = getBaseUrl()
  return `${baseUrl}/chat/completions`
}

let abortController: AbortController | null = null

export function abortCurrentRequest() {
  if (abortController) {
    abortController.abort()
    abortController = null
  }
}

const getHeaders = () => {
  const apiKey = getApiKey()
  if (!apiKey) {
    throw new Error(i18n.global.t('configureApiKey'))
  }
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }
}

export async function getAIStreamResponse(
  messages: Message[],
  onChunk: (chunk: string) => void,
  onThinking?: (thinking: string) => void,
  temperature = 0.3
): Promise<void> {
  let buffer = ''
  let isReading = true

  try {
    abortController = new AbortController()
    const signal = abortController.signal

    // 构建包含所有系统提示词的消息列表
    const systemMessages = await getSystemMessages()
    const messagesWithSystemPrompts: Message[] = [...systemMessages, ...messages]

    logger.debug(
      '构建完整消息列表',
      {
        systemMessagesCount: systemMessages.length,
        userMessagesCount: messages.length,
        totalMessages: messagesWithSystemPrompts.length,
      },
      'DeepSeekService'
    )

    const response = await fetch(getApiUrl(), {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        model: getAIModel(),
        messages: messagesWithSystemPrompts,
        temperature,
        stream: true,
      }),
      signal,
    })

    if (!response.ok) {
      throw new Error(i18n.global.t('httpError', { status: response.status }))
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error(i18n.global.t('streamError'))
    }

    // 统计与健壮性增强
    let emittedDone = false
    let totalBytes = 0
    let dataLineCount = 0
    let eventCount = 0
    const textDecoder = new TextDecoder()

    while (isReading) {
      const { done, value } = await reader.read()
      if (done) {
        isReading = false
        break
      }

      // 累计读取字节数
      totalBytes += value?.length || 0

      buffer += textDecoder.decode(value)
      // 兼容 CRLF 与 LF 的换行符
      const lines = buffer.split(/\r?\n/)
      buffer = lines.pop() || ''

      for (const rawLine of lines) {
        const line = rawLine.trim()
        // 只处理以 data: 开头的事件，兼容 "data:" 与 "data: "
        if (!line.startsWith('data:')) continue
        const payload = line.substring(5).trim()
        dataLineCount++
        if (payload === '[DONE]') {
          emittedDone = true
          isReading = false
          onChunk('[DONE]')
          return
        }
        try {
          const parsedData: AIStreamResponse = JSON.parse(payload)
          const content = parsedData.choices[0]?.delta?.content
          const reasoningContent = parsedData.choices[0]?.delta?.reasoning_content

          if (content) {
            eventCount++
            onChunk(content)
          }

          if (reasoningContent && onThinking) {
            eventCount++
            onThinking(reasoningContent)
          }
        } catch (error) {
          // 保持鲁棒性：解析失败不阻塞后续事件
          handleError(error, i18n.global.t('jsonParseError'), 'DeepSeekService')
        }
      }
    }

    // 流正常结束但未接收到 [DONE]，补发一次 done 以保证 UI 收尾
    if (!emittedDone) {
      logger.debug(
        '流式响应结束但未收到 [DONE]，执行补发收尾',
        { totalBytes, dataLineCount, eventCount },
        'DeepSeekService'
      )
      onChunk('[DONE]')
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      logger.warn(i18n.global.t('requestAborted'), error, 'DeepSeekService')
      onChunk('[ABORTED]')
    } else {
      handleError(error, i18n.global.t('aiResponseError'), 'DeepSeekService')
      throw error
    }
  } finally {
    abortController = null
  }
}

export async function getAIResponse(userMessage: string, temperature = 0.3): Promise<string> {
  try {
    // 构建包含所有系统提示词的消息列表
    const systemMessages = await getSystemMessages()
    const userMessages = [
      {
        role: 'user' as const,
        content: userMessage,
      },
    ]

    const messages = [...systemMessages, ...userMessages]

    logger.debug(
      '构建 AI 响应消息列表',
      {
        systemMessagesCount: systemMessages.length,
        userMessagesCount: userMessages.length,
        totalMessages: messages.length,
      },
      'DeepSeekService'
    )

    const response = await fetch(getApiUrl(), {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        model: getAIModel(),
        messages,
        temperature,
        stream: false,
      }),
    })

    if (!response.ok) {
      throw new Error(i18n.global.t('httpError', { status: response.status }))
    }

    const data = await response.json()

    if (data && data.choices && data.choices.length > 0) {
      return data.choices[0].message?.content || ''
    } else {
      throw new Error(i18n.global.t('invalidAiResponse'))
    }
  } catch (error) {
    handleError(error, i18n.global.t('aiResponseError'), 'DeepSeekService')
    if (error instanceof Error) {
      if (error.message === i18n.global.t('configureApiKey')) {
        throw error
      } else if (error.message.startsWith('HTTP 错误')) {
        throw new Error(i18n.global.t('apiError', { error: error.message }))
      } else if (error.message === i18n.global.t('invalidAiResponse')) {
        throw error
      } else {
        throw new Error(i18n.global.t('networkConnectionError'))
      }
    }
    throw new Error(i18n.global.t('unknownError'))
  }
}

export async function optimizeText(text: string): Promise<string> {
  try {
    // 文本优化使用专门的系统提示词，不受用户自定义系统提示词影响
    const response = await fetch(getApiUrl(), {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        model: getAIModel(),
        messages: [
          {
            role: 'system',
            content:
              '你是一个专业的文本优化助手，擅长提升文本质量。请按以下要求优化文本：\n1. 使表达更自然流畅、逻辑清晰\n2. 修正语法错误和标点符号使用\n3. 保持原意的同时提升表达效果\n4. 确保语言风格一致且符合语境\n5. 直接返回优化后的文本，无需返回其他任何多余内容',
          },
          {
            role: 'user',
            content: `请优化文本：\n"${text}"`,
          },
        ],
        temperature: 0.3,
        stream: false,
      }),
    })

    if (!response.ok) {
      throw new Error(i18n.global.t('httpError', { status: response.status }))
    }

    const data = await response.json()

    if (data && data.choices && data.choices.length > 0) {
      return data.choices[0].message?.content || ''
    } else {
      throw new Error(i18n.global.t('invalidAiResponse'))
    }
  } catch (error) {
    handleError(error, i18n.global.t('textOptimizationError'), 'DeepSeekService')
    throw error
  }
}
