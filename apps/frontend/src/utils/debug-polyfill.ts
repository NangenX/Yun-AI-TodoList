/**
 * Debug 模块的浏览器 polyfill
 * 解决 mermaid 依赖 debug 模块在浏览器环境中的兼容性问题
 */

// 简单的 debug 函数实现
function createDebug(namespace: string) {
  const debug = function (formatter: string, ...args: unknown[]) {
    // 在开发环境下输出调试信息
    if (process.env.NODE_ENV === 'development') {
      console.log(`[${namespace}] ${formatter}`, ...args)
    }
  }

  // 添加 debug 模块的常用属性
  debug.enabled = process.env.NODE_ENV === 'development'
  debug.namespace = namespace
  debug.extend = (suffix: string) => createDebug(`${namespace}:${suffix}`)

  return debug
}

// 模拟 debug 模块的主要功能
const debug = Object.assign(createDebug, {
  enabled: (_namespace: string) => process.env.NODE_ENV === 'development',
  disable: () => {
    // 空实现，保持与 debug 模块兼容
  },
  enable: (_namespaces: string) => {
    // 空实现，保持与 debug 模块兼容
  },
  coerce: (val: unknown) => val,
  formatters: {},
  selectColor: () => 0,
  humanize: (ms: number) => `${ms}ms`,
}) as typeof createDebug & {
  enabled: (namespace: string) => boolean
  disable: () => void
  enable: (namespaces: string) => void
  coerce: (val: unknown) => unknown
  formatters: Record<string, unknown>
  selectColor: () => number
  humanize: (ms: number) => string
  debug?: unknown
  default?: unknown
}

// 设置默认的 debug 实例
debug.debug = debug
debug.default = debug

export default debug
export { debug, createDebug }
