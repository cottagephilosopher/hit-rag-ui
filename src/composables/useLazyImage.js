import { ref, onMounted, onUnmounted } from 'vue'

/**
 * 图片延迟加载 Composable
 * 使用 Intersection Observer 实现图片懒加载
 */
export function useLazyImage() {
  const imageCache = new Map() // 缓存已加载的图片
  const loadingImages = ref(new Set()) // 正在加载的图片
  const loadedImages = ref(new Set()) // 已加载的图片
  const failedImages = ref(new Set()) // 加载失败的图片

  /**
   * 加载单个图片
   */
  async function loadImage(url) {
    // 如果已缓存，直接返回
    if (imageCache.has(url)) {
      return imageCache.get(url)
    }

    // 如果正在加载，等待加载完成
    if (loadingImages.value.has(url)) {
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (imageCache.has(url)) {
            clearInterval(checkInterval)
            resolve(imageCache.get(url))
          } else if (failedImages.value.has(url)) {
            clearInterval(checkInterval)
            resolve(null)
          }
        }, 100)
      })
    }

    loadingImages.value.add(url)

    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const blob = await response.blob()
      const objectURL = URL.createObjectURL(blob)

      imageCache.set(url, objectURL)
      loadedImages.value.add(url)
      loadingImages.value.delete(url)

      return objectURL
    } catch (error) {
      console.warn(`❌ 图片加载失败: ${url}`, error)
      failedImages.value.add(url)
      loadingImages.value.delete(url)
      return null
    }
  }

  /**
   * 替换 Markdown 中的图片 URL 为占位符
   */
  function replaceImagesWithPlaceholder(markdown) {
    const imageRegex = /!\[([^\]]*)\]\(([^\s\n)]+(?:\([^)]*\)[^\s\n)]*)*)\)/g

    return markdown.replace(imageRegex, (match, alt, url) => {
      return `![${alt}](data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'%3E%3Crect width='400' height='300' fill='%23f0f0f0'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' fill='%23999' font-size='16'%3ELoading...%3C/text%3E%3C/svg%3E "lazy:${url}")`
    })
  }

  /**
   * 从 Markdown 中提取图片 URL
   */
  function extractImageUrls(markdown) {
    const imageRegex = /!\[([^\]]*)\]\(([^\s\n)]+(?:\([^)]*\)[^\s\n)]*)*)\)/g
    const urls = []
    let match

    while ((match = imageRegex.exec(markdown)) !== null) {
      urls.push(match[2])
    }

    return urls
  }

  /**
   * 延迟加载 Markdown 中的图片
   */
  async function lazyLoadMarkdownImages(markdown, container) {
    const imageUrls = extractImageUrls(markdown)

    if (imageUrls.length === 0) return

    // 使用 requestIdleCallback 在浏览器空闲时加载图片
    const loadImages = async () => {
      for (const url of imageUrls) {
        if (imageCache.has(url)) continue

        const objectURL = await loadImage(url)
        if (objectURL && container) {
          // 更新 DOM 中的图片
          const imgs = container.querySelectorAll(`img[title^="lazy:${url}"]`)
          imgs.forEach(img => {
            img.src = objectURL
            img.removeAttribute('title')
          })
        }
      }
    }

    // 在下一个事件循环中加载图片，避免阻塞主线程
    if (window.requestIdleCallback) {
      window.requestIdleCallback(loadImages, { timeout: 2000 })
    } else {
      setTimeout(loadImages, 100)
    }
  }

  /**
   * 使用 Intersection Observer 监听元素可见性
   */
  function observeElement(element, callback) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            callback(entry.target)
            observer.unobserve(entry.target)
          }
        })
      },
      {
        rootMargin: '50px', // 提前 50px 开始加载
        threshold: 0.01
      }
    )

    observer.observe(element)
    return observer
  }

  /**
   * 处理 HTML 中的图片延迟加载
   * 使用浏览器原生的 loading="lazy" 属性
   */
  function setupLazyLoadForImages(container) {
    if (!container) return

    const images = container.querySelectorAll('img:not([loading])')

    images.forEach((img) => {
      // 添加浏览器原生的延迟加载属性
      img.setAttribute('loading', 'lazy')

      // 添加加载状态样式
      img.style.backgroundColor = '#f0f0f0'
      img.style.minHeight = '100px'

      // 图片加载完成后移除背景
      img.addEventListener('load', () => {
        img.style.backgroundColor = 'transparent'
      }, { once: true })
    })

    console.log(`📸 已设置 ${images.length} 张图片为延迟加载`)
  }

  /**
   * 批量预加载图片
   */
  async function preloadImages(urls, onProgress) {
    const total = urls.length
    let loaded = 0

    for (const url of urls) {
      await loadImage(url)
      loaded++
      if (onProgress) {
        onProgress(loaded, total)
      }
    }
  }

  /**
   * 清理资源
   */
  onUnmounted(() => {
    imageCache.forEach((url) => {
      URL.revokeObjectURL(url)
    })
    imageCache.clear()
  })

  return {
    imageCache,
    loadingImages,
    loadedImages,
    failedImages,
    loadImage,
    replaceImagesWithPlaceholder,
    extractImageUrls,
    lazyLoadMarkdownImages,
    observeElement,
    setupLazyLoadForImages,
    preloadImages
  }
}
