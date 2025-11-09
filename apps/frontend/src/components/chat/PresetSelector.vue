<template>
  <div class="preset-selector-container">
    <!-- 预设选择器 -->
    <div class="relative flex-1 md:flex-none">
      <select
        v-model="selectedPreset"
        :class="[
          'w-full md:w-auto px-3 py-1.5 pr-7 text-xs border rounded-lg transition-all duration-200 focus:outline-none backdrop-blur-sm min-w-[140px] md:min-w-[100px] lg:min-w-[120px] md:text-xs appearance-none truncate',
          'bg-white/10 text-white border-white/20 cursor-pointer hover:bg-white/15 focus:bg-white/15 focus:border-white/40',
        ]"
        @change="handlePresetChange"
      >
        <option v-if="!selectedPreset" value="" disabled class="text-gray-800">
          {{ t('selectPreset', '选择预设') }}
        </option>

        <!-- AI 提供商预设 -->
        <optgroup
          v-if="aiProviderPresets.length > 0"
          :label="t('aiProviderPresets', 'AI 提供商预设')"
          class="text-gray-800"
        >
          <option
            v-for="preset in aiProviderPresets"
            :key="`ai-${preset.id}`"
            :value="`ai-${preset.id}`"
            class="text-gray-800"
          >
            {{ preset.name }} ({{ getProviderDisplayName(preset.provider) }})
          </option>
        </optgroup>
      </select>

      <!-- 自定义下拉箭头 -->
      <div
        class="absolute right-1.5 top-0 bottom-0 flex items-center justify-center pointer-events-none min-w-[20px]"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="text-white/70 transition-colors duration-200 flex-shrink-0"
        >
          <polyline points="6,8 10,12 14,8"></polyline>
        </svg>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsState } from '../../composables/useSettingsState'
import { saveAIModel, saveAIProvider, saveApiKey, saveBaseUrl } from '../../services/configService'

const { t } = useI18n()

// 设置状态管理
const { localProvider, localApiKey, localBaseUrl, localModel } = useSettingsState()

// 当前选中的预设
const selectedPreset = ref('')

// AI 提供商预设（从 localStorage 加载）
const aiProviderPresets = ref<
  Array<{
    id: string
    name: string
    provider: string
    apiKey: string
    baseUrl: string
    model: string
    createdAt: number
  }>
>([])

// 获取提供商显示名称
const getProviderDisplayName = (provider: string): string => {
  const providerNames: Record<string, string> = {
    openai: 'OpenAI',
    deepseek: 'DeepSeek',
    anthropic: 'Anthropic',
    google: 'Google',
    azure: 'Azure',
    custom: '自定义',
  }
  return providerNames[provider] || provider
}

// 加载 AI 提供商预设
const loadAIProviderPresets = () => {
  try {
    const saved = localStorage.getItem('ai_api_presets')
    if (saved) {
      aiProviderPresets.value = JSON.parse(saved)
    }
  } catch (error) {
    console.warn('Failed to load AI provider presets:', error)
  }
}

// 处理预设切换
const handlePresetChange = async () => {
  if (!selectedPreset.value) return

  const [type, id] = selectedPreset.value.split('-')

  try {
    if (type === 'ai') {
      // 切换 AI 提供商预设
      const preset = aiProviderPresets.value.find((p) => p.id === id)
      if (preset) {
        // 更新本地设置状态
        localProvider.value = preset.provider
        localApiKey.value = preset.apiKey
        localBaseUrl.value = preset.baseUrl
        localModel.value = preset.model

        // 保存到 localStorage
        saveAIProvider(preset.provider)
        saveApiKey(preset.apiKey)
        saveBaseUrl(preset.baseUrl)
        saveAIModel(preset.model as never) // 类型转换，因为预设可能包含更多模型类型

        emit('preset-changed', {
          type: 'ai-provider',
          preset: preset,
        })
      }
    }
  } catch (error) {
    console.error('Failed to switch preset:', error)
  }
}

// 检查当前激活的预设
const checkCurrentPreset = () => {
  // 检查 AI 提供商预设
  const currentConfig = {
    provider: localProvider.value,
    apiKey: localApiKey.value,
    baseUrl: localBaseUrl.value,
    model: localModel.value,
  }

  const matchingPreset = aiProviderPresets.value.find(
    (preset) =>
      preset.provider === currentConfig.provider &&
      preset.apiKey === currentConfig.apiKey &&
      preset.baseUrl === currentConfig.baseUrl &&
      preset.model === currentConfig.model
  )

  if (matchingPreset) {
    selectedPreset.value = `ai-${matchingPreset.id}`
  } else {
    selectedPreset.value = ''
  }
}

// 定义事件
interface Emits {
  (
    e: 'preset-changed',
    payload: {
      type: 'ai-provider' | 'system-prompt'
      preset: unknown
    }
  ): void
}

const emit = defineEmits<Emits>()

// 监听设置变化，同步预设状态
watch(
  () => [localProvider.value, localApiKey.value, localBaseUrl.value, localModel.value],
  () => {
    checkCurrentPreset()
  },
  { deep: true }
)

// 监听 localStorage 变化，当设置页面保存新预设时自动更新
const handleStorageChange = (e: Event) => {
  const storageEvent = e as unknown as { key: string | null }
  if (storageEvent.key === 'ai_api_presets') {
    loadAIProviderPresets()
    checkCurrentPreset()
  }
}

// 监听自定义事件，当预设更新时实时刷新
const handlePresetsUpdated = (_e: Event) => {
  loadAIProviderPresets()
  checkCurrentPreset()
}

// 组件挂载时初始化
onMounted(() => {
  loadAIProviderPresets()
  checkCurrentPreset()

  // 监听 localStorage 变化
  window.addEventListener('storage', handleStorageChange)
  // 监听自定义预设更新事件
  window.addEventListener('ai-presets-updated', handlePresetsUpdated)
})

// 组件卸载时清理监听器
onUnmounted(() => {
  window.removeEventListener('storage', handleStorageChange)
  window.removeEventListener('ai-presets-updated', handlePresetsUpdated)
})

defineOptions({
  name: 'PresetSelector',
})
</script>

<style scoped>
.preset-selector-container {
  @apply flex items-center gap-2 w-full md:w-auto;
}

/* 选择框样式增强 */
select {
  background-image: none;
}

select:focus {
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.1);
}

/* 选项组样式 */
optgroup {
  font-weight: 600;
  color: #374151;
  background-color: #f9fafb;
}

option {
  padding: 8px 12px;
  color: #374151;
  background-color: white;
}

option:hover {
  background-color: #f3f4f6;
}

/* 响应式优化 */
@media (max-width: 639px) {
  .preset-selector-container {
    @apply flex-col gap-1;
  }

  select {
    @apply text-xs;
    min-width: 120px !important;
  }
}
</style>
