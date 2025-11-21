import { logger } from '../utils/logger'
import { getWebSearchApiKey } from './configService'

export type WebSearchEngine = 'search_std' | 'search_pro' | 'search_pro_sogou' | 'search_pro_quark'
export type WebSearchRecency = 'oneDay' | 'oneWeek' | 'oneMonth' | 'oneYear' | 'noLimit'
export type WebSearchContentSize = 'medium' | 'high'

export interface WebSearchOptions {
  engine?: WebSearchEngine
  intent?: boolean
  count?: number
  domainFilter?: string
  recency?: WebSearchRecency
  contentSize?: WebSearchContentSize
  requestId?: string
  userId?: string
}

export interface WebSearchItem {
  title?: string
  content?: string
  link?: string
  media?: string
  icon?: string
  refer?: string
  publish_date?: string
}

export interface WebSearchResponse {
  id?: string
  created?: number
  request_id?: string
  search_intent?: Array<{
    query?: string
    intent?: 'SEARCH_ALL' | 'SEARCH_NONE' | 'SEARCH_ALWAYS'
    keywords?: string
  }>
  search_result?: WebSearchItem[]
}

export const performWebSearch = async (
  query: string,
  options: WebSearchOptions = {}
): Promise<WebSearchResponse> => {
  const apiKey = getWebSearchApiKey()
  if (!apiKey) {
    throw new Error('Web Search API Key is not configured')
  }

  const payload = {
    search_query: (query || '').slice(0, 70),
    search_engine: options.engine || 'search_std',
    search_intent: options.intent ?? true,
    count: Math.min(Math.max(options.count ?? 5, 1), 50),
    search_domain_filter: options.domainFilter || undefined,
    search_recency_filter: options.recency || 'noLimit',
    content_size: options.contentSize || 'medium',
    request_id: options.requestId || undefined,
    user_id: options.userId || undefined,
  }

  try {
    const res = await fetch('https://open.bigmodel.cn/api/paas/v4/web_search', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Web search HTTP ${res.status}: ${text}`)
    }

    const data = (await res.json()) as WebSearchResponse
    return data
  } catch (error) {
    logger.error('Web search request failed', error, 'WebSearchService')
    throw error
  }
}
