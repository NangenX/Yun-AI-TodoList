import DOMPurify from 'dompurify'
import hljs from 'highlight.js'
import katex from 'katex'
import type { MarkedOptions } from 'marked'
import { marked } from 'marked'
// 使用动态导入避免初始化问题
let mermaid: typeof import('mermaid').default | null = null
let mermaidLoadPromise: Promise<typeof import('mermaid').default> | null = null
// Mermaid 全局初始化状态（避免多个组件重复初始化）
let mermaidInitialized = false
let currentMermaidTheme: 'default' | 'dark' | null = null

// 全局缩放函数 - 确保在全局作用域中可访问
declare global {
  interface Window {
    zoomMermaid: (button: HTMLElement, action: 'in' | 'out' | 'reset') => void
    // 防止在 HMR 或多次加载下重复安装全局事件监听器
    __mermaidEventsInstalled?: boolean
  }
}

// 事件委托处理 Mermaid 缩放和拖拽功能
;(() => {
  if (typeof window !== 'undefined') {
    // 仅安装一次全局事件委托，避免在 HMR 或多次导入时重复绑定
    if ((window as unknown as { __mermaidEventsInstalled?: boolean }).__mermaidEventsInstalled) {
      return
    }
    ;(window as unknown as { __mermaidEventsInstalled?: boolean }).__mermaidEventsInstalled = true

    let isDragging = false
    let dragStartX = 0
    let dragStartY = 0
    let currentTranslateX = 0
    let currentTranslateY = 0
    let dragTarget: HTMLElement | null = null
    let animationFrameId: number | null = null
    const pendingTransform = { x: 0, y: 0 }
    let lastUpdateTime = 0
    const MIN_UPDATE_INTERVAL = 16 // 约60fps

    // 优化的拖拽更新函数，使用 requestAnimationFrame 和时间戳节流
    const updateDragTransform = (timestamp: number) => {
      if (dragTarget && isDragging) {
        // 使用时间戳控制更新频率
        if (timestamp - lastUpdateTime >= MIN_UPDATE_INTERVAL) {
          dragTarget.style.setProperty('--mermaid-translate-x', `${pendingTransform.x}px`)
          dragTarget.style.setProperty('--mermaid-translate-y', `${pendingTransform.y}px`)
          lastUpdateTime = timestamp
        }
      }
      animationFrameId = null
    }

    // 缩放按钮点击事件
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement
      const button = target.closest('.mermaid-zoom-btn') as HTMLElement | null
      if (button) {
        const action = button.getAttribute('data-action') as 'in' | 'out' | 'reset'
        const container = button.closest('.mermaid-container') as HTMLElement

        if (!container || !action) {
          console.warn('Mermaid container or action not found')
          return
        }

        // 根据屏幕尺寸确定默认缩放比例
        const getDefaultScale = () => {
          // 统一桌面和移动端的默认缩放，与 CSS 默认值保持一致
          return '1.1'
        }

        const currentScale = parseFloat(
          container.style.getPropertyValue('--mermaid-scale') || getDefaultScale()
        )
        let newScale = currentScale

        switch (action) {
          case 'in':
            newScale = Math.min(currentScale * 1.2, 5.0) // 最大5倍
            break
          case 'out':
            newScale = Math.max(currentScale / 1.2, 0.2) // 最小0.2倍
            break
          case 'reset':
            // 重置缩放比例为默认值
            newScale = parseFloat(getDefaultScale())
            // 重置时也重置位移
            container.style.setProperty('--mermaid-translate-x', '0px')
            container.style.setProperty('--mermaid-translate-y', '0px')
            break
        }

        container.style.setProperty('--mermaid-scale', newScale.toString())
      }
    })

    // 拖拽开始事件
    document.addEventListener('mousedown', (event) => {
      const target = event.target as HTMLElement
      const svgElement = target.closest('svg')
      const container = target.closest('.mermaid-container') as HTMLElement

      if (svgElement && container && !target.closest('.mermaid-zoom-btn')) {
        isDragging = true
        dragTarget = container
        dragStartX = event.clientX
        dragStartY = event.clientY

        // 获取当前的位移值
        currentTranslateX = parseFloat(
          container.style.getPropertyValue('--mermaid-translate-x') || '0'
        )
        currentTranslateY = parseFloat(
          container.style.getPropertyValue('--mermaid-translate-y') || '0'
        )

        // 添加拖拽状态类，优化CSS过渡效果
        container.classList.add('dragging')

        // 改变鼠标样式
        document.body.style.cursor = 'grabbing'
        svgElement.style.cursor = 'grabbing'
        event.preventDefault()
      }
    })

    // 优化的拖拽移动事件，使用节流和更平滑的计算
    document.addEventListener('mousemove', (event) => {
      if (isDragging && dragTarget) {
        // 根据设备类型动态调整阻尼系数
        const isMobile = window.innerWidth <= 768
        const dampingFactor = isMobile ? 0.8 : 1.0

        // 计算移动距离，添加轻微的阻尼效果提升手感
        const deltaX = (event.clientX - dragStartX) * dampingFactor
        const deltaY = (event.clientY - dragStartY) * dampingFactor

        pendingTransform.x = currentTranslateX + deltaX
        pendingTransform.y = currentTranslateY + deltaY

        // 使用 requestAnimationFrame 节流更新，提升性能和流畅度
        if (!animationFrameId) {
          animationFrameId = requestAnimationFrame(updateDragTransform)
        }

        event.preventDefault()
      }
    })

    // 拖拽结束事件
    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false

        // 移除拖拽状态类
        if (dragTarget) {
          dragTarget.classList.remove('dragging')
        }

        dragTarget = null
        document.body.style.cursor = ''

        // 清理动画帧
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId)
          animationFrameId = null
        }

        // 恢复 SVG 鼠标样式
        const svgElements = document.querySelectorAll('.mermaid-diagram svg')
        svgElements.forEach((svg) => {
          ;(svg as HTMLElement).style.cursor = 'grab'
        })
      }
    })

    // 防止拖拽时选中文本
    document.addEventListener('selectstart', (event) => {
      if (isDragging) {
        event.preventDefault()
      }
    })

    // 处理鼠标离开窗口的情况
    document.addEventListener('mouseleave', () => {
      if (isDragging) {
        isDragging = false

        // 移除拖拽状态类
        if (dragTarget) {
          dragTarget.classList.remove('dragging')
        }

        dragTarget = null
        document.body.style.cursor = ''

        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId)
          animationFrameId = null
        }
      }
    })
  }
})()

// 语言显示名称映射 - 优化版本，支持动态降级
const getLanguageDisplayName = (lang: string): string => {
  // 核心语言映射，保持用户友好的显示
  const coreLanguageMap: Record<string, string> = {
    javascript: 'JavaScript',
    typescript: 'TypeScript',
    python: 'Python',
    java: 'Java',
    cpp: 'C++',
    c: 'C',
    csharp: 'C#',
    php: 'PHP',
    ruby: 'Ruby',
    go: 'Go',
    rust: 'Rust',
    swift: 'Swift',
    kotlin: 'Kotlin',
    scala: 'Scala',
    html: 'HTML',
    css: 'CSS',
    scss: 'SCSS',
    sass: 'Sass',
    less: 'Less',
    json: 'JSON',
    xml: 'XML',
    yaml: 'YAML',
    yml: 'YAML',
    toml: 'TOML',
    ini: 'INI',
    sql: 'SQL',
    bash: 'Bash',
    shell: 'Shell',
    powershell: 'PowerShell',
    dockerfile: 'Dockerfile',
    markdown: 'Markdown',
    md: 'Markdown',
    vue: 'Vue',
    react: 'React',
    jsx: 'JSX',
    tsx: 'TSX',
    text: '纯文本',
    plaintext: '纯文本',
  }

  const normalizedLang = lang.toLowerCase()

  // 优先使用核心映射
  if (coreLanguageMap[normalizedLang]) {
    return coreLanguageMap[normalizedLang]
  }

  // 尝试从 highlight.js 获取语言信息
  try {
    const langInfo = hljs.getLanguage(normalizedLang)
    if (langInfo?.name) {
      return langInfo.name
    }
  } catch (error: unknown) {
    // 静默处理错误，使用降级方案
    console.warn(`无法获取语言 ${normalizedLang} 的详细信息`, error)
  }

  // 降级方案：首字母大写
  return lang.charAt(0).toUpperCase() + lang.slice(1).toLowerCase()
}

// 存储 Mermaid SVG 的 Map，以便在 DOMPurify 清理后注入
const mermaidSvgMap = new Map<string, string>()
// 基于源码和主题的渲染缓存，避免重复的 mermaid.render 调用
const mermaidCodeCache = new Map<string, string>()

// 稳定的字符串哈希（djb2），用于生成缓存键
const stableHash = (str: string): string => {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    // 通过位运算保持为 32 位整数
    hash = (hash << 5) + hash + str.charCodeAt(i)
    hash |= 0
  }
  // 返回非负十六进制字符串
  return (hash >>> 0).toString(16)
}

export function useMarkdown() {
  // 获取当前主题
  const getCurrentTheme = (): 'default' | 'dark' => {
    if (typeof document !== 'undefined') {
      const theme = document.documentElement.getAttribute('data-theme')
      return theme === 'dark' ? 'dark' : 'default'
    }
    return 'default'
  }

  // 动态加载 mermaid - 使用单例模式避免重复加载
  const loadMermaid = async () => {
    if (mermaid) {
      return mermaid
    }

    if (mermaidLoadPromise) {
      return await mermaidLoadPromise
    }

    mermaidLoadPromise = (async () => {
      try {
        // 设置全局变量以解决 debug 模块问题
        if (typeof window !== 'undefined') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(window as any).process = {
            browser: true,
            env: { DEBUG: '', NODE_ENV: 'production' },
            platform: 'browser',
            version: 'v18.0.0',
          }
        }

        const mermaidModule = await import('mermaid')
        // 兼容不同的模块导出格式
        mermaid = mermaidModule.default || mermaidModule

        // 确保 mermaid 实例有效
        if (!mermaid || typeof mermaid.initialize !== 'function') {
          throw new Error('Mermaid module loaded but missing required methods')
        }

        return mermaid
      } catch (error) {
        console.error('Failed to load mermaid:', error)
        mermaidLoadPromise = null
        throw error
      }
    })()

    return await mermaidLoadPromise
  }

  // 初始化 Mermaid 配置
  const initializeMermaid = async (theme: 'default' | 'dark' = 'default', forceReinit = false) => {
    // 避免重复初始化相同主题，除非强制重新初始化
    if (mermaidInitialized && currentMermaidTheme === theme && !forceReinit) {
      return
    }

    try {
      // 确保 mermaid 已加载
      const mermaidInstance = await loadMermaid()

      // 确保 mermaidInstance 存在且有 initialize 方法
      if (!mermaidInstance || typeof mermaidInstance.initialize !== 'function') {
        throw new Error('Mermaid instance is invalid or missing initialize method')
      }
      const isDark = theme === 'dark'
      // 动态获取 CSS 变量值，确保主题一致性
      const computedStyle = getComputedStyle(document.documentElement)
      const textColor =
        computedStyle.getPropertyValue('--text-color').trim() || (isDark ? '#ffffff' : '#000000')
      const backgroundColor =
        computedStyle.getPropertyValue('--bg-color').trim() || (isDark ? '#1a1a1a' : '#ffffff')
      const primaryColor = computedStyle.getPropertyValue('--primary-color').trim() || '#d4c18a'
      const fontStack =
        '"LXGW WenKai Medium", "LXGW WenKai Lite Medium", -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Helvetica, Arial, sans-serif'

      mermaidInstance.initialize({
        startOnLoad: false,
        theme: theme,
        securityLevel: 'loose',
        maxTextSize: 100000, // 增加最大文本大小限制
        // 添加字体渲染优化配置
        fontFamily: fontStack,
        fontSize: 16, // 设置默认字体大小
        flowchart: {
          useMaxWidth: false, // 使用最大宽度
          htmlLabels: true, // 启用HTML标签
          curve: 'linear', // 使用线性曲线
          padding: 40, // 增加内边距
          nodeSpacing: 100, // 从 80 增加，让节点更疏朗
          rankSpacing: 120, // 从 100 增加，让层级更清晰
        },
        sequence: {
          diagramMarginX: 60,
          diagramMarginY: 40,
          actorMargin: 50,
          width: 300, // 从 250 增加，让参与者框更宽
          height: 100,
          boxMargin: 20, // 从 15 增加
          boxTextMargin: 8,
          noteMargin: 15,
          messageMargin: 60, // 从 50 增加，让消息线更长
          mirrorActors: true,
          bottomMarginAdj: 1,
          useMaxWidth: true,
        },
        gantt: {
          titleTopMargin: 25,
          barHeight: 20,
          topPadding: 50,
          rightPadding: 75,
          leftPadding: 75,
          gridLineStartPadding: 350,
          numberSectionStyles: 4,
          axisFormat: '%m-%d',
          fontSize: 18, // 从 16 增加
          sectionFontSize: 20, // 从 18 增加
        },
        // 支持中文字体
        // fontFamily 已在顶层配置中设置
        journey: {
          diagramMarginX: 80,
          diagramMarginY: 30,
          leftMargin: 150,
          width: 250, // 从 200 增加
          height: 75, // 从 65 增加
          boxMargin: 10,
          boxTextMargin: 5,
        },
        timeline: {
          diagramMarginX: 80,
          diagramMarginY: 30,
          leftMargin: 150,
          width: 250, // 从 200 增加
          height: 75, // 从 65 增加
        },
        mindmap: {
          padding: 30, // 从 20 增加
          maxNodeWidth: 250, // 从 200 增加
        },
        gitGraph: {
          mainBranchName: 'main',
          showBranches: true,
          showCommitLabel: true,
          rotateCommitLabel: true,
        },
        themeVariables: {
          primaryColor: primaryColor,
          primaryTextColor: textColor,
          primaryBorderColor: primaryColor,
          lineColor: textColor,
          secondaryColor: backgroundColor,
          tertiaryColor: backgroundColor,
          background: backgroundColor,
          mainBkg: backgroundColor,
          secondBkg: backgroundColor,
          tertiaryBkg: backgroundColor,
          fontFamily: fontStack,
          fontSize: '18px',
          fontWeight: 'normal',
          textColor: textColor,
          labelTextColor: textColor,
          nodeTextColor: textColor,
          edgeLabelBackground: backgroundColor,
          clusterTextColor: textColor,
          titleColor: textColor,
          // 添加字体渲染优化
          textRendering: 'geometricPrecision',

          // 流程图相关文字颜色
          nodeBorder: primaryColor,
          clusterBkg: backgroundColor,
          clusterBorder: primaryColor,
          defaultLinkColor: textColor,

          // 序列图相关文字颜色
          actorBkg: backgroundColor,
          actorBorder: primaryColor,
          actorTextColor: textColor,
          actorLineColor: textColor,
          signalColor: textColor,
          signalTextColor: textColor,
          labelBoxBkgColor: backgroundColor,
          labelBoxBorderColor: primaryColor,
          loopTextColor: textColor,
          noteBorderColor: primaryColor,
          noteBkgColor: backgroundColor,
          noteTextColor: textColor,
          activationBorderColor: primaryColor,
          activationBkgColor: backgroundColor,
          sequenceNumberColor: textColor,

          // 甘特图相关文字颜色
          sectionBkgColor: backgroundColor,
          altSectionBkgColor: backgroundColor,
          gridColor: textColor,
          section0: primaryColor,
          section1: primaryColor,
          section2: primaryColor,
          section3: primaryColor,

          // 类图相关文字颜色
          classText: textColor,

          // 状态图相关文字颜色
          labelColor: textColor,

          // Git 图相关文字颜色
          git0: primaryColor,
          git1: primaryColor,
          git2: primaryColor,
          git3: primaryColor,
          git4: primaryColor,
          git5: primaryColor,
          git6: primaryColor,
          git7: primaryColor,
          gitBranchLabel0: textColor,
          gitBranchLabel1: textColor,
          gitBranchLabel2: textColor,
          gitBranchLabel3: textColor,
          gitBranchLabel4: textColor,
          gitBranchLabel5: textColor,
          gitBranchLabel6: textColor,
          gitBranchLabel7: textColor,

          // --- [修改] 饼图相关文字颜色和尺寸 - 增大字体 ---
          pieTitleTextSize: '30px', // 从 '28px' 增加
          pieTitleTextColor: textColor,
          pieSectionTextSize: '22px', // 从 '20px' 增加
          pieSectionTextColor: textColor,
          pieLegendTextSize: '20px', // 从 '18px' 增加
          pieLegendTextColor: textColor,
          pieStrokeColor: textColor,
          pieStrokeWidth: '2px',
          pieOuterStrokeWidth: '2px',
          pieOuterStrokeColor: textColor,
          pieOpacity: '0.7',

          // 旅程图相关文字颜色
          fillType0: primaryColor,
          fillType1: primaryColor,
          fillType2: primaryColor,
          fillType3: primaryColor,
          fillType4: primaryColor,
          fillType5: primaryColor,
          fillType6: primaryColor,
          fillType7: primaryColor,
        },
      })

      // 更新初始化状态
      mermaidInitialized = true
      currentMermaidTheme = theme
    } catch (error: unknown) {
      console.error('Mermaid 初始化失败:', error)
      // 重置状态，允许下次重试
      mermaidInitialized = false
      currentMermaidTheme = null
      mermaid = null
      mermaidLoadPromise = null

      // 抛出错误以便上层处理
      throw new Error(
        `Mermaid initialization failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  // 预处理 LaTeX 数学公式
  const preprocessMathFormulas = (markdown: string): string => {
    // 先保护代码块内容，避免处理其中的 LaTeX 公式
    const codeBlocks: string[] = []
    const codeBlockPlaceholders: string[] = []

    // 匹配所有代码块（包括行内代码和代码块）
    let processedMarkdown = markdown

    // 保护三个反引号的代码块
    processedMarkdown = processedMarkdown.replace(/```[\s\S]*?```/g, (match) => {
      const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`
      codeBlocks.push(match)
      codeBlockPlaceholders.push(placeholder)
      return placeholder
    })

    // 保护行内代码
    processedMarkdown = processedMarkdown.replace(/`[^`\n]+?`/g, (match) => {
      const placeholder = `__INLINE_CODE_${codeBlocks.length}__`
      codeBlocks.push(match)
      codeBlockPlaceholders.push(placeholder)
      return placeholder
    })

    // 处理块级公式 $$...$$
    processedMarkdown = processedMarkdown.replace(/\$\$([\s\S]*?)\$\$/g, (match, _formula) => {
      try {
        // 使用 match 参数来提取公式内容，而不是依赖捕获组
        const formula = match.slice(2, -2) // 移除前后的$$符号
        const html = katex.renderToString(formula.trim(), {
          displayMode: true,
          throwOnError: false,
          strict: false,
        })
        return `<div class="math-block">${html}</div>`
      } catch (error: unknown) {
        // 在错误处理中使用 match 而不是 formula
        console.warn('LaTeX block formula render error:', error)
        return `<div class="math-error">数学公式渲染错误: ${match.slice(2, -2)}</div>`
      }
    })

    // 处理行内公式 $...$（但不处理已经被 $$ 处理过的）
    processedMarkdown = processedMarkdown.replace(
      /(?<!\$)\$(?!\$)([^$\n]+?)\$(?!\$)/g,
      (_, formula) => {
        try {
          const html = katex.renderToString(formula.trim(), {
            displayMode: false,
            throwOnError: false,
            strict: false,
          })
          return `<span class="math-inline">${html}</span>`
        } catch (error: unknown) {
          console.warn('LaTeX inline formula render error:', error)
          return `<span class="math-error">数学公式渲染错误: ${formula}</span>`
        }
      }
    )

    // 恢复代码块内容
    codeBlockPlaceholders.forEach((placeholder, index) => {
      processedMarkdown = processedMarkdown.replace(placeholder, codeBlocks[index])
    })

    return processedMarkdown
  }

  // 一个辅助函数，用于修复常见的 Mermaid 语法错误
  const fixMermaidSyntax = (code: string): string => {
    // 检查是否存在潜在的错误语法
    if (!/style.*style/.test(code)) {
      return code // 如果没有一行内出现多个 style，直接返回
    }

    // 修复连续的 style 定义，将它们拆分成多行
    // 匹配类似 "style A fill:#f0f8e8 style B fill:#some-color" 的模式
    // 并将其转换为两行独立的 style 定义
    let fixedCode = code

    // 使用更精确的正则表达式来匹配和修复 style 语法错误
    // 匹配一个 style 定义后跟另一个 style 定义的情况
    fixedCode = fixedCode.replace(
      /(style\s+[A-Za-z0-9_-]+\s+[^:\n]*:[^:\n]*(?:,[^:\n]*:[^:\n]*)*)\s+(style\s+[A-Za-z0-9_-]+\s+[^:\n]*:[^:\n]*(?:,[^:\n]*:[^:\n]*)*)/g,
      '$1\n$2'
    )

    // 处理可能存在的更多连续 style 定义
    fixedCode = fixedCode.replace(
      /(\nstyle\s+[A-Za-z0-9_-]+\s+[^:\n]*:[^:\n]*(?:,[^:\n]*:[^:\n]*)*)\s+(style\s+[A-Za-z0-9_-]+\s+[^:\n]*:[^:\n]*(?:,[^:\n]*:[^:\n]*)*)/g,
      '$1\n$2'
    )

    // 移除可能产生的多余空行，但保留一个空行
    fixedCode = fixedCode.replace(/\n{3,}/g, '\n\n').trim()

    return fixedCode
  }

  // 预处理 Mermaid 图表
  const preprocessMermaidDiagrams = async (markdown: string): Promise<string> => {
    const mermaidRegex = /```mermaid\n([\s\S]*?)\n```/g
    const matches = [...markdown.matchAll(mermaidRegex)]

    if (matches.length === 0) {
      return markdown
    }

    try {
      // 根据当前主题重新初始化 Mermaid，避免不必要的强制重新初始化
      const currentTheme = getCurrentTheme()
      await initializeMermaid(currentTheme)
    } catch (error) {
      console.warn('Mermaid initialization failed, falling back to code blocks:', error)
      // 降级处理：将 mermaid 代码块转换为普通代码块
      return markdown.replace(mermaidRegex, (_, code) => {
        return `\`\`\`text\n${code.trim()}\n\`\`\``
      })
    }

    let processedMarkdown = markdown

    for (const match of matches) {
      try {
        let diagramCode = match[1]
        // 修复常见语法问题，并进行规范化以提升缓存命中率
        diagramCode = fixMermaidSyntax(diagramCode)
        const normalizedCode = diagramCode.trim()

        // 基于当前主题和源码生成缓存键
        const currentTheme = getCurrentTheme()
        const cacheKey = `${currentTheme}:${stableHash(normalizedCode)}`

        // 使用更稳健的 ID（仅用于 mermaid.render，不影响缓存）
        const id = `mermaid-svg-${Math.random().toString(36).substr(2, 9)}`
        const placeholderId = `mermaid-placeholder-${id}`

        let fullHtml = mermaidCodeCache.get(cacheKey)
        if (!fullHtml) {
          // 确保 mermaid 已加载并渲染
          const mermaidInstance = await loadMermaid()

          // 验证 mermaidInstance 和 render 方法
          if (!mermaidInstance || typeof mermaidInstance.render !== 'function') {
            throw new Error('Mermaid instance is invalid or missing render method')
          }

          const { svg } = await mermaidInstance.render(id, normalizedCode)

          // 优化 SVG 质量：添加高分辨率渲染属性和透明背景
          let optimizedSvg = svg
            .replace(
              '<svg',
              `<svg preserveAspectRatio="xMidYMid meet" style="background: transparent; shape-rendering: geometricPrecision; text-rendering: geometricPrecision; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;"`
            )
            .replace(
              /<rect[^>]*width="100%"[^>]*height="100%"[^>]*fill="[^"']*"[^>]*>/g,
              (match: string) => {
                // 只移除全尺寸的画布背景矩形
                return match.replace(/fill="[^"']*"/, 'fill="transparent"')
              }
            )

          // 确保顶层 SVG 具备宽高属性，避免部分渲染缺省导致容器不填满
          if (!/\bwidth="[^"]*"/.test(optimizedSvg)) {
            optimizedSvg = optimizedSvg.replace('<svg', '<svg width="100%"')
          }
          if (!/\bheight="[^"]*"/.test(optimizedSvg)) {
            optimizedSvg = optimizedSvg.replace('<svg', '<svg height="100%"')
          }

          // 将 SVG 和控制按钮包装为完整容器
          fullHtml = `<div class="mermaid-container">
            <div class="mermaid-zoom-controls" role="toolbar" aria-label="Mermaid 图表缩放控件">
              <button class="mermaid-zoom-btn" data-action="in" title="放大" aria-label="放大">+</button>
              <button class="mermaid-zoom-btn" data-action="out" title="缩小" aria-label="缩小">−</button>
              <button class="mermaid-zoom-btn" data-action="reset" title="重置" aria-label="重置">⌂</button>
              <button class="mermaid-zoom-btn copy-button" data-action="copy" title="复制 Mermaid 源码" aria-label="复制 Mermaid 源码" data-code="${encodeURIComponent(match[1].trim())}">
                <svg class="copy-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2 2v1"></path>
                </svg>
                <span class="copy-text" style="display:none;">复制</span>
              </button>
            </div>
            <div class="mermaid-diagram">${optimizedSvg}</div>
          </div>`

          // 缓存渲染结果，提升后续重复图表的性能
          mermaidCodeCache.set(cacheKey, fullHtml)
        }

        // 存入占位符映射，供后续注入使用
        mermaidSvgMap.set(placeholderId, fullHtml)

        // 使用稳定的占位骨架，避免渲染时页面发生明显布局抖动
        const placeholderHtml = `
          <div id="${placeholderId}" class="mermaid-container" aria-busy="true">
            <div class="mermaid-diagram">
              <div class="mermaid-loading" role="status" aria-live="polite">
                Mermaid 图表加载中…
              </div>
            </div>
          </div>
        `.trim()

        // 替换原始的 mermaid 代码块为占位符骨架
        processedMarkdown = processedMarkdown.replace(match[0], placeholderHtml)
      } catch (error: unknown) {
        console.error('Mermaid rendering error:', error)
        const errorMessage = error instanceof Error ? error.message : String(error)
        const errorHtml = `
          <div class="mermaid-error">
            <strong>Mermaid 图表渲染失败</strong><br>
            <small>错误信息: ${errorMessage}</small><br><br>
            <strong>原始代码:</strong><br>
            <pre><code>${match[1].trim()}</code></pre>
          </div>
        `
        processedMarkdown = processedMarkdown.replace(match[0], errorHtml)
      }
    }

    return processedMarkdown
  }

  // 自定义渲染器
  const renderer = new marked.Renderer()

  renderer.code = function ({ text, lang }: { text: string; lang?: string }) {
    // Mermaid 图表已在预处理阶段处理，这里不再特殊处理

    // 处理普通代码块
    const language = lang || 'text'
    const displayLanguage = getLanguageDisplayName(language)
    const highlightedCode =
      lang && hljs.getLanguage(lang)
        ? hljs.highlight(text, { language: lang }).value
        : hljs.highlightAuto(text).value

    // 生成唯一ID用于代码块标识
    const codeBlockId = `code-${Math.random().toString(36).substr(2, 9)}`

    return `
      <div class="code-block-container" data-code-block-id="${codeBlockId}">
        <div class="code-block-header">
          <span class="code-language">${displayLanguage}</span>
          <button class="copy-button" data-code="${encodeURIComponent(text)}" data-code-block="${codeBlockId}">
            <svg class="copy-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2 2v1"></path>
            </svg>
            <span class="copy-text">复制</span>
          </button>
        </div>
        <pre class="code-content"><code class="hljs language-${language}">${highlightedCode}</code></pre>
      </div>
    `
  }

  renderer.strong = function ({ tokens }: { tokens: any }) {
    const inner = (
      this as unknown as { parser: { parseInline: (t: any) => string } }
    ).parser.parseInline(tokens)
    return `<strong class="ai-md-bold" style="font-weight: 650; color: var(--text-color); background: linear-gradient(transparent 70%, var(--primary-soft) 30%); padding: 0 2px; border-bottom: 2px solid var(--primary-medium); border-radius: 2px;">${inner}</strong>`
  }

  marked.setOptions({
    renderer,
    highlight: function (code: string, lang: string) {
      try {
        return hljs.highlight(code, { language: lang }).value
      } catch (err: unknown) {
        console.error('Error highlighting code:', err)
        return code
      }
    },
  } as MarkedOptions)

  const sanitizeContent = async (content: string): Promise<string> => {
    // 首先预处理 LaTeX 数学公式
    let processedContent = preprocessMathFormulas(content)
    // 然后预处理 Mermaid 图表
    processedContent = await preprocessMermaidDiagrams(processedContent)
    const rawHtml = await marked.parse(processedContent)
    return DOMPurify.sanitize(rawHtml as string)
  }

  // 提取思考内容并返回处理后的内容
  const extractThinkingContent = (content: string): { thinking: string; response: string } => {
    const thinkRegex = /<think>([\s\S]*?)<\/think>/g
    let thinking = ''
    let response = content

    // 提取所有思考内容
    let match
    while ((match = thinkRegex.exec(content)) !== null) {
      thinking += match[1].trim() + '\n\n'
    }

    // 移除思考标签，保留响应内容
    response = content.replace(thinkRegex, '').trim()

    return {
      thinking: thinking.trim(),
      response: response,
    }
  }

  // 设置代码复制功能 - 使用事件委托，更安全可靠
  const setupCodeCopyFunction = () => {
    // 移除之前可能存在的事件监听器
    document.removeEventListener('click', handleCopyButtonClick)

    // 添加事件委托监听器
    document.addEventListener('click', handleCopyButtonClick)
  }

  // 处理复制按钮点击事件
  const handleCopyButtonClick = async (event: Event) => {
    const target = event.target as HTMLElement

    // 检查是否点击了复制按钮或其子元素
    const copyButton = target.closest('.copy-button') as HTMLButtonElement | null
    if (!copyButton || !copyButton.dataset.code) {
      return
    }

    event.preventDefault()
    event.stopPropagation()

    try {
      // 解码存储的代码内容
      const code = decodeURIComponent(copyButton.dataset.code)

      // 尝试使用现代 Clipboard API
      await navigator.clipboard.writeText(code)

      updateButtonState(copyButton, 'success')
    } catch (error: unknown) {
      console.warn('Clipboard API 失败，尝试降级方案:', error)

      // 降级方案：使用 document.execCommand
      try {
        const code = decodeURIComponent(copyButton.dataset.code || '')
        const textArea = document.createElement('textarea')
        textArea.value = code
        textArea.style.position = 'fixed'
        textArea.style.left = '-999999px'
        textArea.style.top = '-999999px'
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()

        const successful = document.execCommand('copy')
        document.body.removeChild(textArea)

        if (successful) {
          updateButtonState(copyButton, 'success')
        } else {
          throw new Error('execCommand 复制失败')
        }
      } catch (fallbackError: unknown) {
        console.error('所有复制方案都失败:', fallbackError)
        updateButtonState(copyButton, 'error')
      }
    }
  }

  // 更新按钮状态的辅助函数
  const updateButtonState = (button: HTMLButtonElement | null, state: 'success' | 'error') => {
    if (!button) return
    const copyText = button.querySelector('.copy-text')
    if (!copyText) return

    const originalText = copyText.textContent || '复制'

    if (state === 'success') {
      copyText.textContent = '已复制'
      button.classList.add('copied')
    } else {
      copyText.textContent = '复制失败'
      button.classList.add('error')
    }

    // 2秒后恢复原始状态
    setTimeout(() => {
      copyText.textContent = originalText
      button.classList.remove('copied', 'error')
    }, 2000)
  }

  // 渲染 Markdown（现在是异步函数）
  const renderMarkdown = async (markdown: string): Promise<string> => {
    if (!markdown) return ''

    try {
      // 首先预处理 LaTeX 数学公式
      let processedMarkdown = preprocessMathFormulas(markdown)

      // 然后预处理 Mermaid 图表
      processedMarkdown = await preprocessMermaidDiagrams(processedMarkdown)

      // 使用 marked 解析 markdown
      const html = await marked.parse(processedMarkdown, {
        renderer,
        gfm: true,
        breaks: true,
        sanitize: false,
      } as MarkedOptions)

      // 使用 DOMPurify 清理 HTML
      const cleanHtml = DOMPurify.sanitize(html, {
        ALLOWED_TAGS: [
          'h1',
          'h2',
          'h3',
          'h4',
          'h5',
          'h6',
          'p',
          'br',
          'strong',
          'em',
          'u',
          'del',
          'code',
          'pre',
          'blockquote',
          'ul',
          'ol',
          'li',
          'a',
          'img',
          'table',
          'thead',
          'tbody',
          'tr',
          'th',
          'td',
          'div',
          'span',
          'svg',
          'g',
          'path',
          'rect',
          'circle',
          'ellipse',
          'line',
          'polyline',
          'polygon',
          'text',
          'tspan',
          'defs',
          'marker',
          'button',
          // KaTeX 数学公式相关标签
          'math',
          'semantics',
          'mrow',
          'msup',
          'msub',
          'msubsup',
          'mfrac',
          'msqrt',
          'mroot',
          'mi',
          'mn',
          'mo',
          'mtext',
          'mspace',
          'menclose',
          'mpadded',
          'mphantom',
          'munder',
          'mover',
          'munderover',
          'mtable',
          'mtr',
          'mtd',
          'mlabeledtr',
          'maligngroup',
          'malignmark',
          'mstyle',
          'merror',
          'mfenced',
          'mmultiscripts',
          'mprescripts',
          'none',
          'annotation',
        ],
        ALLOWED_ATTR: [
          'href',
          'src',
          'alt',
          'title',
          'class',
          'id',
          'style',
          'data-*',
          'viewBox',
          'width',
          'height',
          'fill',
          'stroke',
          'stroke-width',
          'd',
          'x',
          'y',
          'x1',
          'y1',
          'x2',
          'y2',
          'cx',
          'cy',
          'r',
          'rx',
          'ry',
          'points',
          'transform',
          'text-anchor',
          'font-size',
          'font-family',
          'font-weight',
          'dx',
          'dy',
          'markerWidth',
          'markerHeight',
          'orient',
          'refX',
          'refY',
          // KaTeX 数学公式相关属性
          'xmlns',
          'display',
          'mathvariant',
          'mathsize',
          'mathcolor',
          'mathbackground',
          'dir',
          'fontfamily',
          'fontsize',
          'fontweight',
          'fontstyle',
          'color',
          'background',
          'scriptlevel',
          'displaystyle',
          'scriptsizemultiplier',
          'scriptminsize',
          'infixlinebreakstyle',
          'decimalpoint',
          'fence',
          'separator',
          'stretchy',
          'symmetric',
          'maxsize',
          'minsize',
          'largeop',
          'movablelimits',
          'accent',
          'lspace',
          'rspace',
          'linebreak',
          'lineleading',
          'linebreakstyle',
          'linebreakmultchar',
          'indentalign',
          'indentshift',
          'indenttarget',
          'indentalignfirst',
          'indentshiftfirst',
          'indentalignlast',
          'indentshiftlast',
          'depth',
          'lquote',
          'rquote',
          'linethickness',
          'munalign',
          'denomalign',
          'bevelled',
          'voffset',
          'open',
          'close',
          'separators',
          'notation',
          'subscriptshift',
          'superscriptshift',
          'accentunder',
          'align',
          'rowalign',
          'columnalign',
          'groupalign',
          'alignmentscope',
          'columnwidth',
          'rowspacing',
          'columnspacing',
          'rowlines',
          'columnlines',
          'frame',
          'framespacing',
          'equalrows',
          'equalcolumns',
          'side',
          'minlabelspacing',
          'rowspan',
          'columnspan',
          'edge',
          'stackalign',
          'charalign',
          'charspacing',
          'longdivstyle',
          'position',
          'shift',
          'location',
          'crossout',
          'length',
          'leftoverhang',
          'rightoverhang',
          'mslinethickness',
          'selection',
        ],
        ALLOW_DATA_ATTR: true,
      })

      return cleanHtml
    } catch (error: unknown) {
      console.error('Markdown rendering error:', error)
      return `<p>渲染失败: ${error}</p>`
    }
  }

  // 重新初始化 Mermaid（用于主题切换时调用）
  const reinitializeMermaid = async () => {
    try {
      const currentTheme = getCurrentTheme()
      await initializeMermaid(currentTheme)
    } catch (error) {
      console.warn('Mermaid reinitialization failed:', error)
    }
  }

  // 新增一个 getter 函数来访问 map
  const getMermaidSvgMap = () => mermaidSvgMap

  return {
    sanitizeContent,
    extractThinkingContent,
    setupCodeCopyFunction,
    renderMarkdown,
    reinitializeMermaid,
    // 新增导出
    getMermaidSvgMap,
    // 仅用于测试的导出
    fixMermaidSyntax,
  }
}
