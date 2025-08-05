import 'highlight.js/styles/github-dark.css'
import 'highlight.js/styles/github.css'
import 'katex/dist/katex.min.css'
import { registerSW } from 'virtual:pwa-register'
import 'virtual:uno.css'
import { createApp } from 'vue'
import App from './App.vue'
import i18n, { setUserPreferencesManager } from './i18n/index'
import router from './router/index.ts'
import './styles/global.css'
import { logger } from './utils/logger.ts'
import { initPWA } from './utils/pwa'

const updateSW = registerSW({
  onNeedRefresh() {
    // 显示更新提示
    const shouldUpdate = confirm('发现新版本！\n\n新版本包含功能改进和错误修复。\n是否立即更新？')
    if (shouldUpdate) {
      updateSW(true)
    }
  },
  onOfflineReady() {
    logger.info('应用已准备好离线使用', undefined, 'PWA')
  },
  onRegisterError(error: Error) {
    logger.error('Service Worker 注册失败', error, 'PWA')
  },
})

// 应用初始化函数
async function initializeApp() {
  try {
    // 初始化 PWA 功能
    await initPWA()

    // 初始化认证状态和用户偏好设置
    const { useAuth } = await import('./composables/useAuth')
    const { useUserPreferences } = await import('./composables/useUserPreferences')

    const { initAuth } = useAuth()
    const userPreferences = useUserPreferences()

    // 设置 i18n 的用户偏好设置管理器
    setUserPreferencesManager(userPreferences)

    // 初始化认证状态
    await initAuth()

    // 用户偏好设置会通过 watch 监听器自动初始化
    // logger.info('认证状态已初始化', undefined, 'App')

    // logger.info('应用初始化完成', undefined, 'App')
  } catch (error) {
    logger.error('应用初始化失败', error, 'App')
  }
}

// 启动应用
initializeApp().catch((error) => {
  logger.error('应用启动失败', error, 'App')
})

createApp(App).use(router).use(i18n).mount('#app')
