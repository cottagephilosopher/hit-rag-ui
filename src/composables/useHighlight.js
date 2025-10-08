import { ref } from 'vue'

export function useHighlight() {
  const activeChunkId = ref(null)

  function highlightChunk(chunkId, scrollToChunkList = false) {
    // 移除之前的高亮
    document.querySelectorAll('.highlight-section').forEach(el => {
      el.classList.remove('highlight-section')
    })

    document.querySelectorAll('.chunk-item.active').forEach(el => {
      el.classList.remove('active')
    })

    // 添加新的高亮
    activeChunkId.value = chunkId

    // 高亮左侧原文
    const originalChunk = document.querySelector(
      `.original-chunk[data-chunk-id="${chunkId}"]`
    )
    if (originalChunk) {
      originalChunk.classList.add('highlight-section')
      originalChunk.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }

    // 高亮右侧chunk卡片
    const chunkCard = document.querySelector(
      `.chunk-item[data-chunk-id="${chunkId}"]`
    )
    if (chunkCard) {
      chunkCard.classList.add('active')

      // 如果需要滚动到 chunk list
      if (scrollToChunkList) {
        chunkCard.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }

  function clearHighlight() {
    document.querySelectorAll('.highlight-section').forEach(el => {
      el.classList.remove('highlight-section')
    })

    document.querySelectorAll('.chunk-item.active').forEach(el => {
      el.classList.remove('active')
    })

    activeChunkId.value = null
  }

  return {
    activeChunkId,
    highlightChunk,
    clearHighlight
  }
}
