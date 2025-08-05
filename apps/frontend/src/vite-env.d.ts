/// <reference types="vite/client" />

// 声明全局变量
declare const __ELECTRON__: boolean

// 扩展 Window 接口
declare global {
  interface Window {
    electronAPI?: {
      openExternal: (url: string) => void
      getVersion: () => string
      minimize: () => void
      maximize: () => void
      close: () => void
      isMaximized: () => boolean
      onWindowStateChange: (callback: (isMaximized: boolean) => void) => void
    }
  }

  // 添加全局类型定义
  interface Storage {
    readonly length: number
    clear(): void
    getItem(key: string): string | null
    key(index: number): string | null
    removeItem(key: string): void
    setItem(key: string, value: string): void
    [name: string]: string | null
  }

  interface StorageEvent extends Event {
    readonly key: string | null
    readonly newValue: string | null
    readonly oldValue: string | null
    readonly storageArea: Storage | null
    readonly url: string
  }

  interface EventListener {
    (evt: Event): void
  }

  interface EventListenerObject {
    handleEvent(object: Event): void
  }
}

// 声明 .vue 文件模块
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, unknown>
  export default component
}
