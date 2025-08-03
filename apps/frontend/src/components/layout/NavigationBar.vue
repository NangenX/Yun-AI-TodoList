<template>
  <div class="nav-bar">
    <button
      class="nav-button"
      :class="{ 'nav-button-active': $route.path === '/' }"
      :title="t('home')"
      @click="router.push('/')"
    >
      <i class="i-carbon-task text-sm"></i>
      <span class="nav-text">{{ t('home') }}</span>
    </button>

    <button
      class="nav-button"
      :class="{ 'nav-button-active': $route.path === '/calendar' }"
      :title="t('calendar')"
      @click="router.push('/calendar')"
    >
      <i class="i-carbon-calendar text-sm"></i>
      <span class="nav-text">{{ t('calendar') }}</span>
    </button>

    <button
      class="nav-button"
      :class="{ 'nav-button-active': $route.path === '/settings' }"
      :title="t('settings')"
      @click="router.push('/settings')"
    >
      <i class="i-carbon-settings text-sm"></i>
      <span class="nav-text">{{ t('settings') }}</span>
    </button>

    <!-- 认证状态按钮 -->
    <div v-if="!isAuthenticated" class="auth-buttons">
      <button
        class="nav-button auth-button"
        :title="t('auth.login')"
        @click="router.push('/login')"
      >
        <i class="i-carbon-login text-sm"></i>
        <span class="nav-text">{{ t('auth.login') }}</span>
      </button>
    </div>

    <!-- 用户菜单 -->
    <div v-else ref="userMenuRef" class="user-menu" @click="toggleUserMenu">
      <button class="nav-button user-button" :title="user?.username || user?.email?.split('@')[0]">
        <i class="i-carbon-user text-sm"></i>
        <span class="nav-text">{{ user?.username || user?.email?.split('@')[0] }}</span>
        <i
          class="i-carbon-chevron-down text-xs chevron"
          :class="{ 'rotate-180': showUserMenu }"
        ></i>
      </button>

      <!-- 用户下拉菜单 -->
      <div v-if="showUserMenu" class="user-dropdown">
        <div class="user-info">
          <div class="user-avatar">
            <i class="i-carbon-user text-lg"></i>
          </div>
          <div class="user-details">
            <div class="user-name">{{ user?.username || '用户' }}</div>
            <div class="user-email">{{ user?.email }}</div>
          </div>
        </div>

        <!-- 存储状态信息 -->
        <div class="menu-divider"></div>
        <div class="storage-status">
          <div class="storage-header">
            <i class="i-carbon-cloud text-sm"></i>
            <span class="storage-title">云端存储</span>
          </div>
          <div class="status-info">
            <div class="status-indicator" :class="getConnectionStatusClass()">
              <div class="indicator-dot"></div>
              <span class="indicator-text">{{ getConnectionStatusText() }}</span>
            </div>
            <div v-if="networkStatus.lastCheckTime" class="check-time">
              <span class="check-text"
                >上次检查：{{ formatTime(networkStatus.lastCheckTime) }}</span
              >
            </div>
          </div>
          <button :disabled="isCheckingHealth" class="health-check-btn" @click="checkHealth">
            <i class="i-carbon-checkmark-outline text-xs"></i>
            {{ isCheckingHealth ? '检查中...' : '健康检查' }}
          </button>
          <div
            class="health-status"
            :class="{
              'text-green-500': healthStatus === true,
              'text-red-500': healthStatus === false,
            }"
          >
            {{ getHealthStatusText() }}
          </div>
        </div>

        <div class="menu-divider"></div>
        <button class="menu-item" @click="handleLogout">
          <i class="i-carbon-logout text-sm mr-2"></i>
          {{ t('auth.logout') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuth } from '../../composables/useAuth'
import { useNotifications } from '../../composables/useNotifications'
import { useStorageMode } from '../../composables/useStorageMode'
import { useSyncManager } from '../../composables/useSyncManager'
import router from '../../router'

const { t } = useI18n()
const { isAuthenticated, user, logout } = useAuth()
const { success, error } = useNotifications()
const { networkStatus, checkStorageHealth } = useStorageMode()
const { checkServerHealth, networkStatusText } = useSyncManager()

// 用户菜单状态
const showUserMenu = ref(false)
const userMenuRef = ref<HTMLElement>()
const isCheckingHealth = ref(false)
const healthStatus = ref<boolean | null>(null)

const toggleUserMenu = () => {
  showUserMenu.value = !showUserMenu.value
}

// 存储状态相关计算属性
const getConnectionStatusClass = () => {
  if (!networkStatus.value.isOnline) return 'status-offline'
  if (!networkStatus.value.isServerReachable) return 'status-error'
  if (networkStatus.value.consecutiveFailures > 0) return 'status-warning'
  return 'status-online'
}

const getConnectionStatusText = () => {
  return networkStatusText.value || t('unknown')
}

const getHealthStatusText = () => {
  if (healthStatus.value === null) return t('unknown')
  return healthStatus.value ? t('healthy') : t('unhealthy')
}

const formatTime = (time: string | Date) => {
  const date = typeof time === 'string' ? new Date(time) : time
  return date.toLocaleString()
}

const checkHealth = async () => {
  isCheckingHealth.value = true
  try {
    healthStatus.value = await checkStorageHealth()
    await checkServerHealth()
  } catch (error) {
    console.error('Health check failed:', error)
    healthStatus.value = false
  } finally {
    isCheckingHealth.value = false
  }
}

const handleLogout = async () => {
  try {
    await logout()
    showUserMenu.value = false
    success('登出成功', '您已安全登出')
    router.push('/')
  } catch (err) {
    console.error('Logout failed:', err)
    error('登出失败', '请稍后重试')
  }
}

// 点击外部关闭用户菜单
onMounted(async () => {
  const handleClickOutside = (event: Event) => {
    if (userMenuRef.value && !userMenuRef.value.contains(event.target as Node)) {
      showUserMenu.value = false
    }
  }

  document.addEventListener('click', handleClickOutside)

  onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside)
  })
})

defineOptions({
  name: 'NavigationBar',
})
</script>

<style scoped>
.nav-bar {
  position: absolute;
  top: 1rem;
  right: 1rem;
  display: flex;
  gap: 0.5rem;
  z-index: 1000;
}

.nav-button {
  background-color: var(--language-toggle-bg);
  color: var(--language-toggle-color);
  border: 1px solid var(--language-toggle-color);
  border-radius: 10px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.3s ease;
  padding: 10px 16px;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.nav-button:hover {
  background-color: var(--language-toggle-hover-bg);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
  border-color: var(--primary-color);
}

.nav-button-active {
  background-color: var(--primary-color);
  color: white;
  border-color: var(--primary-color);
  box-shadow: 0 4px 12px rgba(121, 180, 166, 0.3);
}

.nav-button-active:hover {
  background-color: var(--primary-hover);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(121, 180, 166, 0.4);
}

@media (max-width: 768px) {
  .nav-bar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    width: 100%;
    background-color: var(--card-bg-color);
    padding: 0.2rem;
    margin: 0;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    justify-content: space-around;
    gap: 0.1rem;
    backdrop-filter: blur(10px);
    box-sizing: border-box;
    z-index: 1000;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .nav-button {
    flex: 1;
    font-size: 10px;
    padding: 4px 2px;
    text-align: center;
    min-width: 40px;
    border-radius: 4px;
    font-weight: 500;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    min-height: 32px;
  }

  .nav-button i {
    font-size: 12px;
    margin: 0;
  }

  .nav-text {
    font-size: 9px;
    margin-top: 1px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
  }

  .chevron {
    display: none;
  }

  .nav-button:hover {
    transform: translateY(-1px);
  }
}

/* 极小屏幕优化 (320px-375px) */
@media (max-width: 375px) {
  .nav-bar {
    gap: 0.05rem;
    padding: 0.1rem;
  }

  .nav-button {
    font-size: 8px;
    padding: 3px 1px;
    min-width: 32px;
    gap: 0px;
    min-height: 28px;
  }

  .nav-button i {
    font-size: 10px;
  }

  .nav-text {
    display: none;
  }

  .chevron {
    display: none;
  }

  /* 用户菜单在极小屏幕下的优化 */
  .user-dropdown {
    @apply w-56 right-0;
  }

  .user-info {
    @apply p-3;
  }

  .user-name {
    @apply text-xs;
  }

  .user-email {
    @apply text-xs;
  }

  .menu-item {
    @apply py-2.5 text-xs;
  }
}

/* 认证按钮样式 */
.auth-buttons {
  @apply flex gap-2;
}

.auth-button {
  @apply flex items-center;
}

.register-button {
  @apply bg-primary text-white;
}

.register-button:hover {
  @apply bg-primary-hover;
}

/* 用户菜单样式 */
.user-menu {
  @apply relative;
}

.user-button {
  @apply flex items-center gap-2 bg-primary text-white;
}

.user-button:hover {
  @apply bg-primary-hover;
}

.user-dropdown {
  @apply absolute top-full right-0 mt-2 w-64 bg-card border border-border rounded-xl shadow-lg backdrop-blur-sm z-50;
  @apply transform transition-all duration-200 ease-out;
}

.user-info {
  @apply flex items-center gap-3 p-4;
}

.user-avatar {
  @apply w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary;
}

.user-details {
  @apply flex-1 min-w-0;
}

.user-name {
  @apply font-medium text-text text-sm truncate;
}

.user-email {
  @apply text-text-secondary text-xs truncate;
}

.menu-divider {
  @apply h-px bg-border mx-4;
}

.menu-item {
  @apply w-full flex items-center gap-2 px-4 py-3 text-left text-sm text-text hover:bg-bg-secondary transition-colors;
  @apply rounded-none first:rounded-t-none last:rounded-b-xl;
}

.menu-item:hover {
  @apply bg-bg-secondary;
}

/* 深色主题适配 */
[data-theme='dark'] .user-dropdown {
  @apply bg-card-dark border-border-dark;
}

[data-theme='dark'] .user-name {
  @apply text-text-dark;
}

[data-theme='dark'] .user-email {
  @apply text-text-secondary-dark;
}

[data-theme='dark'] .menu-item {
  @apply text-text-dark hover:bg-bg-secondary-dark;
}

/* 存储状态样式 */
.storage-status {
  @apply px-4 py-3;
}

.storage-header {
  @apply flex items-center gap-2 mb-2;
}

.storage-title {
  @apply text-sm font-medium text-text;
}

.status-info {
  @apply mb-3;
}

.status-indicator {
  @apply flex items-center gap-2 mb-1;
}

.indicator-dot {
  @apply w-2 h-2 rounded-full;
}

.indicator-text {
  @apply text-xs text-text-secondary;
}

.check-time {
  @apply ml-4;
}

.check-text {
  @apply text-xs text-text-secondary;
}

.health-check-btn {
  @apply w-full flex items-center justify-center gap-1 px-3 py-1.5 text-xs bg-primary/10 text-primary rounded-md hover:bg-primary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-2;
}

.health-status {
  @apply text-xs text-center font-medium;
}

/* 状态指示器颜色 */
.status-online .indicator-dot {
  @apply bg-green-500;
}

.status-warning .indicator-dot {
  @apply bg-yellow-500;
}

.status-error .indicator-dot {
  @apply bg-red-500;
}

.status-offline .indicator-dot {
  @apply bg-gray-500;
}

/* 深色主题适配 */
[data-theme='dark'] .storage-title {
  @apply text-text-dark;
}

[data-theme='dark'] .indicator-text {
  @apply text-text-secondary-dark;
}

[data-theme='dark'] .check-text {
  @apply text-text-secondary-dark;
}

[data-theme='dark'] .health-check-btn {
  @apply bg-primary/20 hover:bg-primary/30;
}
</style>
