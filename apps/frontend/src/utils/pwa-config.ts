/**
 * PWA 配置优化工具
 * 解决 manifest 图标和缓存问题
 */

export interface PWAConfig {
  manifestIcons: Array<{
    src: string
    sizes: string
    type: string
    purpose?: string
  }>
  cacheStrategies: {
    images: string
    pages: string
    assets: string
  }
}

/**
 * 获取优化的 PWA 配置
 */
export function getOptimizedPWAConfig(): PWAConfig {
  // 在生产环境中使用绝对路径，开发环境使用相对路径
  const basePath = process.env.NODE_ENV === 'production' ? '/Yun-AI-TodoList/' : './'

  return {
    manifestIcons: [
      {
        src: `${basePath}pwa-192x192.png`,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: `${basePath}pwa-512x512.png`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: `${basePath}pwa-512x512.png`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: `${basePath}apple-touch-icon.png`,
        sizes: '180x180',
        type: 'image/png',
        purpose: 'any',
      },
    ],
    cacheStrategies: {
      images: 'CacheFirst',
      pages: 'NetworkFirst',
      assets: 'StaleWhileRevalidate',
    },
  }
}

/**
 * 验证图标文件是否存在
 */
export async function validatePWAIcons(): Promise<boolean> {
  // 根据环境使用正确的基础路径
  const basePath = process.env.NODE_ENV === 'production' ? '/Yun-AI-TodoList/' : './'
  const icons = [
    `${basePath}pwa-192x192.png`,
    `${basePath}pwa-512x512.png`,
    `${basePath}apple-touch-icon.png`,
  ]

  try {
    const results = await Promise.all(
      icons.map(async (icon) => {
        try {
          const response = await fetch(icon, { method: 'HEAD' })
          return response.ok
        } catch {
          return false
        }
      })
    )

    const allValid = results.every(Boolean)
    if (!allValid) {
      console.warn('[PWA] 部分 PWA 图标文件无法访问')
    }
    return allValid
  } catch {
    console.warn('[PWA] PWA 图标验证失败')
    return false
  }
}

/**
 * 减少 PWA 日志输出的配置
 */

export function configurePWALogging() {
  // 在生产环境中减少 workbox 日志
  if ((import.meta as unknown as { env: { PROD?: boolean } }).env?.PROD) {
    // 覆盖 console.log 以过滤 workbox 日志
    const originalLog = console.log
    console.log = (...args: unknown[]) => {
      const message = args.join(' ')
      if (
        message.includes('workbox') ||
        message.includes('Router is responding to') ||
        message.includes('Using CacheFirst')
      ) {
        return // 忽略 workbox 日志
      }
      originalLog.apply(console, args)
    }
  }
}

/**
 * 配置 PWA 状态栏主题色
 * 根据当前主题动态调整状态栏颜色
 */
export function configurePWAThemeColor() {
  // 获取当前主题
  const isDarkTheme = document.documentElement.getAttribute('data-theme') === 'dark'

  // 设置主题色 - 使用柔和护眼的配色
  const themeColor = isDarkTheme ? '#1a1f24' : '#7db3a5'

  // 更新 meta 标签
  let themeColorMeta = document.querySelector('meta[name="theme-color"]')
  if (!themeColorMeta) {
    themeColorMeta = document.createElement('meta')
    themeColorMeta.setAttribute('name', 'theme-color')
    document.head.appendChild(themeColorMeta)
  }
  themeColorMeta.setAttribute('content', themeColor)

  // 为 iOS Safari 设置状态栏样式
  let statusBarMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')
  if (!statusBarMeta) {
    statusBarMeta = document.createElement('meta')
    statusBarMeta.setAttribute('name', 'apple-mobile-web-app-status-bar-style')
    document.head.appendChild(statusBarMeta)
  }
  statusBarMeta.setAttribute('content', isDarkTheme ? 'black-translucent' : 'default')

  // 为 Android 设置状态栏颜色
  let msApplicationMeta = document.querySelector('meta[name="msapplication-navbutton-color"]')
  if (!msApplicationMeta) {
    msApplicationMeta = document.createElement('meta')
    msApplicationMeta.setAttribute('name', 'msapplication-navbutton-color')
    document.head.appendChild(msApplicationMeta)
  }
  msApplicationMeta.setAttribute('content', themeColor)
}
