import { ref, onMounted } from 'vue'

export function useImageLoader() {
  const imageUrlMap = new Map()
  const loadingImages = ref(false)
  const loadingMessage = ref('')

  async function loadImage(url) {
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const blob = await response.blob()
      const objectURL = URL.createObjectURL(blob)
      imageUrlMap.set(url, objectURL)
      return objectURL
    } catch (error) {
      console.warn(`❌ 图片加载失败: ${url}`, error)
      return null
    }
  }

  async function processMarkdownImages(markdown) {
    const imageRegex = /!\[([^\]]*)\]\(([^\s\n)]+(?:\([^)]*\)[^\s\n)]*)*)\)/g
    const matches = [...markdown.matchAll(imageRegex)]

    if (matches.length === 0) return markdown

    loadingImages.value = true
    loadingMessage.value = `正在加载 ${matches.length} 张图片...`

    let processedMarkdown = markdown
    let loadedCount = 0

    for (const match of matches) {
      const [fullMatch, alt, originalUrl] = match

      if (imageUrlMap.has(originalUrl)) {
        const objectURL = imageUrlMap.get(originalUrl)
        processedMarkdown = processedMarkdown.replace(
          new RegExp(fullMatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
          `![${alt}](${objectURL})`
        )
      } else {
        const objectURL = await loadImage(originalUrl)
        loadedCount++
        console.log(`✓ [${loadedCount}/${matches.length}] ${originalUrl.substring(0, 80)}...`)

        if (objectURL) {
          processedMarkdown = processedMarkdown.replace(
            new RegExp(fullMatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
            `![${alt}](${objectURL})`
          )
        }
      }
    }

    loadingImages.value = false
    return processedMarkdown
  }

  onMounted(() => {
    return () => {
      imageUrlMap.forEach(url => URL.revokeObjectURL(url))
    }
  })

  return {
    imageUrlMap,
    loadingImages,
    loadingMessage,
    loadImage,
    processMarkdownImages
  }
}
