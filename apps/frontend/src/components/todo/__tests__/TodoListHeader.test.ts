import { createTestI18n } from '@/test/helpers'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TodoListHeader from '../TodoListHeader.vue'

const i18n = createTestI18n()

// 创建全局配置对象
const globalConfig = {
  plugins: [i18n],
  config: {
    globalProperties: {
      $t: (key: string) => i18n.global.t(key),
    },
  },
}

describe('TodoListHeader', () => {
  const defaultProps = {
    showSearch: false,
  }

  it('应该正确渲染所有按钮', () => {
    const wrapper = mount(TodoListHeader, {
      props: defaultProps,
      global: globalConfig,
    })

    const buttons = wrapper.findAll('.icon-button')
    // 目前包含：AI 按钮、搜索按钮、布局切换按钮、批量分析按钮、AI 排序按钮 共 5 个
    expect(buttons).toHaveLength(5)

    expect(wrapper.find('.ai-assistant-button').exists()).toBe(true)
    expect(wrapper.find('.search-button').exists()).toBe(true)
    expect(wrapper.find('.layout-button').exists()).toBe(true)
    expect(wrapper.find('.batch-analyze-button').exists()).toBe(true)
    expect(wrapper.find('.ai-sort-button').exists()).toBe(true)

    expect(wrapper.find('.ai-assistant-button .button-icon').exists()).toBe(true)
    expect(wrapper.find('.search-button .button-icon').exists()).toBe(true)
    expect(wrapper.find('.batch-analyze-button .button-icon').exists()).toBe(true)
    expect(wrapper.find('.ai-sort-button .button-icon').exists()).toBe(true)

    expect(wrapper.find('.button-text').exists()).toBe(false)
  })

  it('应该在激活状态时添加 active 类', () => {
    const wrapper = mount(TodoListHeader, {
      props: {
        ...defaultProps,
        showSearch: true,
      },
      global: globalConfig,
    })

    expect(wrapper.find('.search-button').classes()).toContain('active')
  })

  it('应该正确触发事件', async () => {
    const wrapper = mount(TodoListHeader, {
      props: defaultProps,
      global: globalConfig,
    })

    await wrapper.find('.search-button').trigger('click')
    expect(wrapper.emitted('toggleSearch')).toHaveLength(1)

    await wrapper.find('.ai-assistant-button').trigger('click')
    expect(wrapper.emitted('openAiSidebar')).toHaveLength(1)
  })

  it('应该显示正确的工具提示', () => {
    const wrapper = mount(TodoListHeader, {
      props: defaultProps,
      global: globalConfig,
    })

    const searchButton = wrapper.find('.search-button')
    expect(searchButton.attributes('title')).toBeTruthy()
  })

  it('应该为按钮显示正确的图标', () => {
    const wrapper = mount(TodoListHeader, {
      props: defaultProps,
      global: globalConfig,
    })

    const aiButton = wrapper.find('.ai-assistant-button svg')
    expect(aiButton.exists()).toBe(true)
    expect(aiButton.attributes('width')).toBe('22')
    expect(aiButton.attributes('height')).toBe('22')

    const searchButton = wrapper.find('.search-button svg')
    expect(searchButton.exists()).toBe(true)
    expect(searchButton.attributes('width')).toBe('22')
    expect(searchButton.attributes('height')).toBe('22')

    const batchAnalyzeButton = wrapper.find('.batch-analyze-button svg')
    expect(batchAnalyzeButton.exists()).toBe(true)
    expect(batchAnalyzeButton.attributes('width')).toBe('22')
    expect(batchAnalyzeButton.attributes('height')).toBe('22')

    const aiSortButton = wrapper.find('.ai-sort-button svg')
    expect(aiSortButton.exists()).toBe(true)
    expect(aiSortButton.attributes('width')).toBe('22')
    expect(aiSortButton.attributes('height')).toBe('22')
  })
})
