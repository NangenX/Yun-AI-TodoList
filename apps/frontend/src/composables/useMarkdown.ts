import DOMPurify from 'dompurify'
import hljs from 'highlight.js'
import katex from 'katex'
import type { MarkedOptions } from 'marked'
import { marked } from 'marked'
// 使用动态导入避免初始化问题
let mermaid: typeof import('mermaid').default | null = null
let mermaidLoadPromise: Promise<typeof import('mermaid').default> | null = null

// 全局缩放函数 - 确保在全局作用域中可访问
declare global {
  interface Window {
    zoomMermaid: (button: HTMLElement, action: 'in' | 'out' | 'reset') => void
  }
}

// 事件委托处理 Mermaid 缩放和拖拽功能
;(() => {
  if (typeof window !== 'undefined') {
    let isDragging = false
    let dragStartX = 0
    let dragStartY = 0
    let currentTranslateX = 0
    let currentTranslateY = 0
    let dragTarget: HTMLElement | null = null
    let animationFrameId: number | null = null
    const pendingTransform = { x: 0, y: 0 }

    // 优化的拖拽更新函数，使用 requestAnimationFrame 节流
    const updateDragTransform = () => {
      if (dragTarget && isDragging) {
        dragTarget.style.setProperty('--mermaid-translate-x', `${pendingTransform.x}px`)
        dragTarget.style.setProperty('--mermaid-translate-y', `${pendingTransform.y}px`)
      }
      animationFrameId = null
    }

    // 缩放按钮点击事件
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement
      if (target.classList.contains('mermaid-zoom-btn')) {
        const action = target.getAttribute('data-action') as 'in' | 'out' | 'reset'
        const container = target.closest('.mermaid-container') as HTMLElement

        if (!container || !action) {
          console.warn('Mermaid container or action not found')
          return
        }

        // 根据屏幕尺寸确定默认缩放比例
        const getDefaultScale = () => {
          if (window.innerWidth <= 768) {
            return '1.4'
          }
          return '1.8'
        }

        const currentScale = parseFloat(
          container.style.getPropertyValue('--mermaid-scale') || getDefaultScale()
        )
        let newScale = currentScale

        switch (action) {
          case 'in':
            newScale = Math.min(currentScale * 1.2, 3.0) // 最大3倍
            break
          case 'out':
            newScale = Math.max(currentScale / 1.2, 0.5) // 最小0.5倍
            break
          case 'reset':
            // 根据屏幕尺寸确定重置缩放比例
            newScale = window.innerWidth <= 768 ? 1.4 : 1.8
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

      if (svgElement && container && !target.classList.contains('mermaid-zoom-btn')) {
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
        // 计算移动距离，添加轻微的阻尼效果提升手感
        const deltaX = (event.clientX - dragStartX) * 1.0 // 可调整阻尼系数
        const deltaY = (event.clientY - dragStartY) * 1.0

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

export function useMarkdown() {
  // Mermaid 初始化状态管理
  let mermaidInitialized = false
  let currentMermaidTheme: 'default' | 'dark' | null = null

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
      const primaryColor = computedStyle.getPropertyValue('--primary-color').trim() || '#79b4a6'
      const fontStack =
        '"LXGW WenKai Medium", "LXGW WenKai Lite Medium", -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Helvetica, Arial, sans-serif'

      mermaidInstance.initialize({
        startOnLoad: false,
        theme: theme,
        securityLevel: 'loose',
        // 支持中文字体
        fontFamily: fontStack,
        // 图表尺寸配置
        flowchart: {
          nodeSpacing: 50,
          rankSpacing: 60,
          padding: 20,
        },
        sequence: {
          width: 150,
          height: 65,
          boxMargin: 10,
          boxTextMargin: 5,
          noteMargin: 10,
          messageMargin: 35,
        },
        gantt: {
          numberSectionStyles: 4,
        },
        journey: {
          diagramMarginX: 50,
          diagramMarginY: 10,
        },
        timeline: {
          diagramMarginX: 50,
          diagramMarginY: 10,
        },
        mindmap: {
          padding: 10,
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

          // 字体相关配置
          fontFamily: fontStack,
          fontSize: '14px',

          // 确保所有文字相关的颜色都使用主题文字颜色
          textColor: textColor,
          labelTextColor: textColor,
          nodeTextColor: textColor,
          edgeLabelBackground: backgroundColor,
          clusterTextColor: textColor,
          titleColor: textColor,

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

          // 饼图相关文字颜色
          pieTitleTextSize: '25px',
          pieTitleTextColor: textColor,
          pieSectionTextSize: '17px',
          pieSectionTextColor: textColor,
          pieLegendTextSize: '17px',
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
      (match, formula) => {
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

  // 预处理 Mermaid 图表
  const preprocessMermaidDiagrams = async (markdown: string): Promise<string> => {
    const mermaidRegex = /```mermaid\n([\s\S]*?)\n```/g
    const matches = [...markdown.matchAll(mermaidRegex)]

    if (matches.length === 0) {
      return markdown
    }

    try {
      // 根据当前主题重新初始化 Mermaid，强制重新初始化以确保主题正确应用
      const currentTheme = getCurrentTheme()
      await initializeMermaid(currentTheme, true)
    } catch (error) {
      console.warn('Mermaid initialization failed, falling back to code blocks:', error)
      // 降级处理：将 mermaid 代码块转换为普通代码块
      return markdown.replace(mermaidRegex, (match, code) => {
        return `\`\`\`text\n${code.trim()}\n\`\`\``
      })
    }

    let processedMarkdown = markdown

    for (const match of matches) {
      try {
        const diagramCode = match[1]
        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`

        // 确保 mermaid 已加载并渲染
        const mermaidInstance = await loadMermaid()

        // 验证 mermaidInstance 和 render 方法
        if (!mermaidInstance || typeof mermaidInstance.render !== 'function') {
          throw new Error('Mermaid instance is invalid or missing render method')
        }

        const { svg } = await mermaidInstance.render(id, diagramCode)

        // 优化 SVG 质量：添加高分辨率渲染属性和透明背景
        // 使用与 Mermaid 初始化时相同的字体栈，确保中文字体正确显示
        const fontStack =
          '"LXGW WenKai Medium", "LXGW WenKai Lite Medium", -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Helvetica, Arial, sans-serif'

        const optimizedSvg = svg
          .replace(
            '<svg',
            `<svg preserveAspectRatio="xMidYMid meet" style="background: transparent; font-family: ${fontStack};"`
          )
          .replace(/width="[^"]*"/, 'width="100%"')
          .replace(/height="[^"]*"/, 'height="auto"')
          .replace(
            /<rect[^>]*width="100%"[^>]*height="100%"[^>]*fill="[^"]*"[^>]*>/g,
            (match: string) => {
              // 只移除全尺寸的画布背景矩形
              return match.replace(/fill="[^"]*"/, 'fill="transparent"')
            }
          )
          // 确保 SVG 内部的文本元素也使用正确的字体
          .replace(/<text([^>]*)>/g, (match, attributes) => {
            // 如果文本元素没有字体设置，添加字体样式
            if (!attributes.includes('font-family') && !attributes.includes('style="')) {
              return `<text${attributes} style="font-family: ${fontStack};">`
            } else if (attributes.includes('style="') && !attributes.includes('font-family')) {
              // 如果有 style 但没有 font-family，添加字体到 style 中
              return match.replace('style="', `style="font-family: ${fontStack}; `)
            }
            return match
          })
          // 确保 SVG 内部的 tspan 元素也使用正确的字体
          .replace(/<tspan([^>]*)>/g, (match, attributes) => {
            // 如果 tspan 元素没有字体设置，添加字体样式
            if (!attributes.includes('font-family') && !attributes.includes('style="')) {
              return `<tspan${attributes} style="font-family: ${fontStack};">`
            } else if (attributes.includes('style="') && !attributes.includes('font-family')) {
              // 如果有 style 但没有 font-family，添加字体到 style 中
              return match.replace('style="', `style="font-family: ${fontStack}; `)
            }
            return match
          })

        // 将渲染好的 SVG 包装在容器中，添加缩放控制
        const wrappedSvg = `<div class="mermaid-container">
          <div class="mermaid-zoom-controls">
            <button class="mermaid-zoom-btn" data-action="in" title="放大">+</button>
            <button class="mermaid-zoom-btn" data-action="out" title="缩小">−</button>
            <button class="mermaid-zoom-btn" data-action="reset" title="重置">⌂</button>
          </div>
          <div class="mermaid-diagram">${optimizedSvg}</div>
        </div>`

        // 替换原始的 mermaid 代码块
        processedMarkdown = processedMarkdown.replace(match[0], wrappedSvg)
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
      await initializeMermaid(currentTheme, true)
    } catch (error) {
      console.warn('Mermaid reinitialization failed:', error)
    }
  }

  return {
    sanitizeContent,
    extractThinkingContent,
    setupCodeCopyFunction,
    renderMarkdown,
    reinitializeMermaid,
  }
}
