<template>
  <!-- 使用 Teleport 保证层级与定位不受父级 transform/overflow 影响 -->
  <Teleport to="body">
    <div v-if="visible && currentTarget" class="onboarding-overlay" @click.self="onSkip">
      <!-- 高亮目标区域 -->
      <div class="spotlight" :style="spotlightStyle"></div>

      <!-- 提示气泡 -->
      <div class="tooltip" :style="tooltipStyle">
        <div class="tooltip-title">{{ currentStep?.title }}</div>
        <div class="tooltip-desc">{{ currentStep?.description }}</div>
        <div class="tooltip-actions">
          <button class="btn btn-secondary" @click="onSkip">
            {{ t('onboarding.header.skip', '跳过') }}
          </button>
          <button class="btn btn-primary" @click="onNext">
            {{
              isLastStep
                ? t('onboarding.header.gotIt', '我知道了')
                : t('onboarding.header.next', '下一步')
            }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
  <!-- 若找不到目标元素，则不显示引导 -->
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Ref } from 'vue'
import { useI18n } from 'vue-i18n'

interface Step {
  targetRef: Ref<HTMLElement | null>
  title: string
  description: string
}

const props = defineProps<{
  steps: Step[]
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'finish'): void
  (e: 'skip'): void
}>()

const { t } = useI18n()

const stepIndex = ref(0)
const currentStep = computed(() => props.steps[stepIndex.value])
const currentTarget = computed<HTMLElement | null>(
  () => currentStep.value?.targetRef?.value || null
)
const isLastStep = computed(() => stepIndex.value >= props.steps.length - 1)

const spotlightStyle = ref<Record<string, string>>({})
const tooltipStyle = ref<Record<string, string>>({})

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(n, max))
}

function updatePositions() {
  const el = currentTarget.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const scrollX = window.scrollX || window.pageXOffset
  const scrollY = window.scrollY || window.pageYOffset

  // 高亮框样式（使用绝对定位并叠加滚动，避免 transform/overflow 影响）
  const padding = 10
  spotlightStyle.value = {
    top: `${Math.max(rect.top + scrollY - padding, 8)}px`,
    left: `${Math.max(rect.left + scrollX - padding, 8)}px`,
    width: `${rect.width + padding * 2}px`,
    height: `${rect.height + padding * 2}px`,
  }

  // 气泡位置：根据上下空间选择在上方或下方
  const viewportWidth = window.innerWidth
  const bubbleWidth = 320
  const bubbleHeight = 120 // 预估高度，用于位置选择；实际绘制后会再次校正
  const spaceBelow = window.innerHeight - rect.bottom
  const placeBelow = spaceBelow > bubbleHeight + 24
  const bubbleTop = (placeBelow ? rect.bottom + 14 : rect.top - bubbleHeight - 14) + scrollY
  const bubbleLeft = clamp(
    rect.left + rect.width / 2 - bubbleWidth / 2 + scrollX,
    12,
    viewportWidth - bubbleWidth - 12
  )

  tooltipStyle.value = {
    top: `${bubbleTop}px`,
    left: `${bubbleLeft}px`,
    width: `${bubbleWidth}px`,
  }
}

function onNext() {
  if (isLastStep.value) {
    emit('finish')
  } else {
    stepIndex.value += 1
    // 下一步后立即更新位置
    requestAnimationFrame(updatePositions)
  }
}

function onSkip() {
  emit('skip')
}

function handleResize() {
  updatePositions()
}

watch(
  () => props.visible,
  (v) => {
    if (v) {
      // 打开时定位
      requestAnimationFrame(updatePositions)
      window.addEventListener('resize', handleResize)
      window.addEventListener('scroll', handleResize, true)
    } else {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('scroll', handleResize, true)
    }
  }
)

// 目标元素变化时，重新定位
watch(currentTarget, () => {
  requestAnimationFrame(updatePositions)
})

onMounted(() => {
  if (props.visible) {
    requestAnimationFrame(updatePositions)
    window.addEventListener('resize', handleResize)
    window.addEventListener('scroll', handleResize, true)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('scroll', handleResize, true)
})
</script>

<style scoped>
.onboarding-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  pointer-events: auto;
}

.onboarding-overlay .spotlight,
.onboarding-overlay .tooltip {
  position: absolute;
}

.spotlight {
  background: rgba(0, 0, 0, 0.5);
  box-shadow:
    0 0 0 9999px rgba(0, 0, 0, 0.5),
    0 4px 20px rgba(255, 126, 103, 0.35);
  border: 2px solid #ff7e67;
  border-radius: 12px;
  transition: all 0.2s ease;
}

.tooltip {
  background: var(--card-bg-color);
  color: var(--text-color);
  border: 1px solid rgba(255, 126, 103, 0.25);
  border-radius: 12px;
  padding: 12px 14px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
  max-width: 90vw;
}

.tooltip-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 6px;
  color: #ff7e67;
}

.tooltip-desc {
  font-size: 13px;
  line-height: 1.6;
  opacity: 0.9;
}

.tooltip-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
  justify-content: flex-end;
}

.btn {
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid rgba(255, 126, 103, 0.25);
  cursor: pointer;
  font-size: 12px;
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-color);
}

.btn-primary {
  background: linear-gradient(135deg, #ff7e67 0%, #ff6b6b 100%);
  color: #fff;
  border-color: rgba(255, 126, 103, 0.4);
}
</style>
