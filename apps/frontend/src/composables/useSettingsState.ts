import { onMounted, ref, watch } from 'vue'
import { apiKey, baseUrl, aiModel, aiProvider, webSearchApiKey } from '../services/configService'

export function useSettingsState() {
  const showApiKey = ref(false)
  const showApiKeyPopover = ref(false)
  const localApiKey = ref('')
  const localWebSearchApiKey = ref('')
  const localBaseUrl = ref('')
  const localModel = ref('')
  const localProvider = ref('deepseek')
  const showSuccessMessage = ref(false)

  const initializeSettings = () => {
    localApiKey.value = apiKey.value
    localWebSearchApiKey.value = webSearchApiKey.value
    localBaseUrl.value = baseUrl.value
    localModel.value = aiModel.value
    localProvider.value = aiProvider.value

    localStorage.removeItem('systemPrompt')
    localStorage.removeItem('lastSelectedTemplate')
    localStorage.removeItem('customPrompts')
    localStorage.removeItem('promptFilter')
    localStorage.removeItem('promptSortOptions')
  }

  // 监听 configService 中响应式变量的变化，实现实时同步
  const setupWatchers = () => {
    watch(apiKey, (newValue) => {
      localApiKey.value = newValue
    })

    watch(webSearchApiKey, (newValue) => {
      localWebSearchApiKey.value = newValue
    })

    watch(baseUrl, (newValue) => {
      localBaseUrl.value = newValue
    })

    watch(aiModel, (newValue) => {
      localModel.value = newValue
    })

    watch(aiProvider, (newValue) => {
      localProvider.value = newValue
    })
  }

  const showSuccessToast = (duration = 2000) => {
    showSuccessMessage.value = true
    setTimeout(() => {
      showSuccessMessage.value = false
    }, duration)
  }

  const toggleShowApiKey = () => {
    showApiKey.value = !showApiKey.value
  }

  onMounted(() => {
    initializeSettings()
    setupWatchers()
  })

  return {
    showApiKey,
    showApiKeyPopover,
    localApiKey,
    localWebSearchApiKey,
    localBaseUrl,
    localModel,
    localProvider,
    showSuccessMessage,
    initializeSettings,
    showSuccessToast,
    toggleShowApiKey,
  }
}
