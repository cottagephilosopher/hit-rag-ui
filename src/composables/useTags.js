import { ref } from 'vue'
import { TAG_COLORS, CONFIG } from '../utils/config'
import { success as showSuccess, error as showError, warning as showWarning } from './useToast'

const API_BASE_URL = CONFIG.baseURL

export function useTags() {
  const documentTags = ref([])
  const showModal = ref(false)
  const currentFilename = ref(null)

  // 从API加载标签
  async function loadTags(filename) {
    if (!filename) return

    currentFilename.value = filename

    try {
      const response = await fetch(`${API_BASE_URL}/api/documents/${encodeURIComponent(filename)}/tags`)
      if (response.ok) {
        const data = await response.json()
        documentTags.value = data.tags || []
        console.log(`✅ 从数据库加载标签:`, documentTags.value)
      } else {
        console.warn('⚠️  无法从数据库加载标签，使用空列表')
        documentTags.value = []
      }
    } catch (error) {
      console.error('❌ 加载标签失败:', error)
      // 回退到 localStorage
      const savedTags = localStorage.getItem(`document_tags_${filename}`)
      if (savedTags) {
        try {
          documentTags.value = JSON.parse(savedTags)
        } catch (e) {
          documentTags.value = []
        }
      }
    }
  }

  // 保存标签到localStorage（作为备份）
  function saveTagsToLocalStorage() {
    if (currentFilename.value) {
      localStorage.setItem(`document_tags_${currentFilename.value}`, JSON.stringify(documentTags.value))
    }
  }

  // 添加标签
  async function addTag(tagText) {
    const trimmed = tagText.trim()
    if (!trimmed) {
      console.warn('⚠️  标签文本为空')
      return false
    }

    if (documentTags.value.includes(trimmed)) {
      console.log(`⚠️  标签 "${trimmed}" 已存在`)
      showWarning(`标签 "${trimmed}" 已存在`)
      return false
    }

    // 检查标签数量限制
    if (documentTags.value.length >= CONFIG.maxDocumentTags) {
      showWarning(`文档标签数量已达上限（${CONFIG.maxDocumentTags}个），请删除部分标签后再添加`)
      return false
    }

    if (!currentFilename.value) {
      console.error('❌ 没有选择文档，currentFilename:', currentFilename.value)
      showWarning('请先选择一个文档')
      return false
    }

    console.log(`🏷️  准备添加标签 "${trimmed}" 到文档 "${currentFilename.value}"`)

    try {
      const url = `${API_BASE_URL}/api/documents/${encodeURIComponent(currentFilename.value)}/tags`
      console.log('📡 请求URL:', url)
      console.log('📦 请求体:', { tag_text: trimmed })

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ tag_text: trimmed })
      })

      console.log('📥 响应状态:', response.status, response.statusText)

      if (response.ok) {
        const result = await response.json()
        documentTags.value.push(trimmed)
        saveTagsToLocalStorage()
        console.log(`✅ 标签添加成功:`, result)
        showSuccess(`标签 "${trimmed}" 添加成功`)
        return true
      } else {
        const error = await response.json()
        console.error('❌ ���加标签失败:', response.status, error)
        showError(`添加标签失败: ${error.detail || '未知错误'}`)
        return false
      }
    } catch (error) {
      console.error('❌ 添加标签失败（网络错误）:', error)
      showError(`添加标签失败: ${error.message}`)
      return false
    }
  }

  // 删除标签
  async function removeTag(tagText) {
    if (!currentFilename.value) {
      console.error('❌ 没有选择文档')
      return
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/documents/${encodeURIComponent(currentFilename.value)}/tags/${encodeURIComponent(tagText)}`,
        {
          method: 'DELETE'
        }
      )

      if (response.ok) {
        const index = documentTags.value.indexOf(tagText)
        if (index > -1) {
          documentTags.value.splice(index, 1)
          saveTagsToLocalStorage()
          console.log(`✅ 标签删除成功: ${tagText}`)
        }
      } else {
        console.error('❌ 删除标签失败')
      }
    } catch (error) {
      console.error('❌ 删除标签失败:', error)
    }
  }

  // 获取标签颜色
  function getTagColor(tagText) {
    const tagIndex = documentTags.value.indexOf(tagText)
    return TAG_COLORS[tagIndex % TAG_COLORS.length]
  }

  // 打开弹窗
  function openModal() {
    showModal.value = true
  }

  // 关闭弹窗
  function closeModal() {
    showModal.value = false
  }

  return {
    documentTags,
    showModal,
    currentFilename,
    loadTags,
    addTag,
    removeTag,
    getTagColor,
    openModal,
    closeModal
  }
}
