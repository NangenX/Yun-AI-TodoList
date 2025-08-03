import { createI18n } from 'vue-i18n'
import en from '../locales/en.json'
import zh from '../locales/zh.json'

type SupportedLocale = 'en' | 'zh'

// 用户偏好设置管理器接口
interface UserPreferencesManager {
  isReady?: { value: boolean }
  updatePreferences: (preferences: { language: SupportedLocale }) => Promise<void>
}

// 用户偏好设置管理器（延迟导入避免循环依赖）
let userPreferencesManager: UserPreferencesManager | null = null

function detectLanguage(): SupportedLocale {
  const browserLang = navigator.language.toLowerCase()
  return browserLang.startsWith('zh') ? 'zh' : 'en'
}

const storedLanguage = localStorage.getItem('language') as SupportedLocale | null
const defaultLanguage = storedLanguage || detectLanguage()

const i18n = createI18n({
  legacy: false,
  locale: defaultLanguage,
  fallbackLocale: 'en',
  messages: {
    en,
    zh,
  },
})

/**
 * 设置用户偏好设置管理器（在应用初始化时调用）
 */
export function setUserPreferencesManager(manager: UserPreferencesManager) {
  userPreferencesManager = manager
}

/**
 * 设置语言并同步到用户偏好设置
 */
export async function setLanguage(lang: SupportedLocale) {
  // 立即更新 i18n 和本地存储
  i18n.global.locale.value = lang
  localStorage.setItem('language', lang)

  // 如果用户偏好设置管理器可用，同步到服务器
  if (userPreferencesManager?.isReady?.value) {
    try {
      await userPreferencesManager.updatePreferences({ language: lang })
    } catch (error) {
      console.warn('Failed to sync language preference:', error)
    }
  }
}

/**
 * 从用户偏好设置更新语言（内部使用，不触发服务器同步）
 */
export function updateLanguageFromPreferences(lang: SupportedLocale) {
  i18n.global.locale.value = lang
  localStorage.setItem('language', lang)
}

export function setSystemLanguage() {
  const systemLang = detectLanguage()
  setLanguage(systemLang)
}

export default i18n
export type { SupportedLocale }
