<template>
  <div
    class="min-h-screen flex flex-col text-text"
    :class="[currentTheme, ...getPlatformClasses()]"
  >
    <NavigationBar />

    <div
      class="flex-1 flex flex-col justify-center items-center p-4 min-h-[calc(100vh-60px)] overflow-hidden transition-all duration-300 ease-in-out pt-16 md:pt-8 md:pb-2 md:justify-start md:overflow-y-auto"
    >
      <div class="w-full max-w-screen-xl-plus flex flex-col justify-center px-2 md:px-4">
        <router-view @open-ai-sidebar="openAISidebar" />
      </div>
      <div
        class="flex flex-col gap-4 mb-4 flex-shrink-0"
        :class="{ 'small-screen': isSmallScreen }"
      ></div>
    </div>

    <!-- Toast 通知组件 -->
    <SimpleToast ref="toastRef" />

    <!-- 全局通知系统 -->
    <NotificationContainer />

    <!-- 同步状态指示器 -->
    <SyncStatusIndicator />

    <!-- AI 助手侧边栏 -->
    <AISidebar :is-open="isAISidebarOpen" @close="closeAISidebar" />
  </div>
</template>

<script setup lang="ts">
import { useWindowSize } from '@vueuse/core'
import { computed, onErrorCaptured, provide, ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import AISidebar from './components/AISidebar.vue'
import NotificationContainer from './components/common/NotificationContainer.vue'
import SimpleToast from './components/common/SimpleToast.vue'
import SyncStatusIndicator from './components/common/SyncStatusIndicator.vue'
import NavigationBar from './components/layout/NavigationBar.vue'
import { useAISidebar } from './composables/useAISidebar'
import { useTheme } from './composables/useTheme'
import { useToast } from './composables/useToast'
import { getPlatformClasses } from './utils/platform'
import { getApiKey, hideApiKeyReminder, shouldShowApiKeyReminder } from './services/configService'

const { theme, systemTheme, initTheme } = useTheme()
const { t } = useI18n()

// 认证状态管理已在 main.ts 中初始化

// AI 侧边栏状态管理
const {
  isOpen: isAISidebarOpen,
  openSidebar: openAISidebar,
  closeSidebar: closeAISidebar,
} = useAISidebar()

onErrorCaptured((err, instance, info) => {
  console.error('Captured error:', err, instance, info)
  return false
})

const currentTheme = computed(() => {
  return theme.value === 'auto' ? systemTheme.value : theme.value
})

provide('theme', theme)

const { width } = useWindowSize()
const isSmallScreen = computed(() => width.value < 768)

// Toast 设置
const toastRef = ref()
const toast = useToast()

onMounted(() => {
  try {
    // 初始化主题
    initTheme()

    // 认证状态已在 main.ts 中初始化，无需重复调用

    // 设置 Toast 实例
    if (toastRef.value) {
      toast.setToastInstance(toastRef.value)
    }

    // 使用 Toast 提示用户配置 API Key（替代原先的弹窗提醒）
    if (!getApiKey() && shouldShowApiKeyReminder()) {
      toast.info(t('apiKeyReminder'))
      // 首次提示后不再重复显示
      hideApiKeyReminder()
    }
  } catch (error) {
    console.error('Error initializing app:', error)
  }
})

// 提供 Toast 实例给子组件
provide('toast', toast)
</script>
