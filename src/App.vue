<template>
  <div>
    <!-- 语义搜索页面 -->
    <SemanticSearch
      v-if="showSemanticSearch"
      @close="showSemanticSearch = false"
      @view-chunk="handleViewChunkFromSearch"
    />

    <!-- 全局标签管理 -->
    <GlobalTagManager
      :show="showGlobalTagManager"
      @close="showGlobalTagManager = false"
      @tags-updated="handleGlobalTagsUpdated"
    />

    <!-- 主界面 -->
    <div v-if="!showSemanticSearch" class="header">
      <h1>📊 RAG 文档切分可视化工具</h1>
      <div class="stats">
        <div class="stat-item">
          <span>📄 文档:</span>
          <span>{{ documentName }}</span>
        </div>
      </div>
      <TagManager
        :tags="documentTags"
        :input-value="tagInput"
        :get-tag-color="getTagColor"
        @update:input-value="tagInput = $event"
        @add-tag="handleAddTag"
        @remove-tag="removeTag"
        @open-modal="openModal"
      />
    </div>

    <div v-if="!showSemanticSearch" class="container">
      <DocumentSelector
        :current-document="currentDocument"
        @document-selected="handleDocumentSelected"
        @document-processing="handleDocumentProcessing"
        @open-search="showSemanticSearch = true"
        @open-tag-manager="showGlobalTagManager = true"
      />

      <DocumentPanel
        :chunks="processedChunks"
        :loading-images="loadingImages"
        :loading-message="loadingMessage"
        @chunk-click="highlightChunkAndScroll"
      />

      <ChunksPanel
        ref="chunksPanelRef"
        :chunks="processedChunks"
        :search-query="searchQuery"
        :current-document="currentDocument"
        @update:search-query="searchQuery = $event"
        @chunk-click="highlightChunk"
        @chunk-updated="handleChunkUpdated"
      />
    </div>

    <TagModal
      :show="showModal"
      :tags="documentTags"
      :get-tag-color="getTagColor"
      @close="closeModal"
      @remove-tag="removeTag"
    />

    <!-- Processing Overlay -->
    <div v-if="isProcessing" class="processing-overlay">
      <div class="processing-modal">
        <div class="processing-spinner">⏳</div>
        <h3>正在处理文档</h3>
        <p class="processing-filename">{{ processingFilename }}</p>
        <p class="processing-tip">这可能需要几分钟时间，请稍候...</p>
        <div class="processing-loader">
          <div class="loader-bar"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { marked } from 'marked'
import DocumentSelector from './components/DocumentSelector.vue'
import DocumentPanel from './components/DocumentPanel.vue'
import ChunksPanel from './components/ChunksPanel.vue'
import TagManager from './components/TagManager.vue'
import TagModal from './components/TagModal.vue'
import SemanticSearch from './components/SemanticSearch.vue'
import GlobalTagManager from './components/GlobalTagManager.vue'
import { useImageLoader } from './composables/useImageLoader'
import { useTags } from './composables/useTags'
import { useHighlight } from './composables/useHighlight'
import { CONFIG } from './utils/config'

// 配置 marked.js
marked.setOptions({
  breaks: true,
  gfm: true,
  tables: true,
  headerIds: false,
  mangle: false,
  sanitize: false
})

// 组合式函数
const { loadingImages, loadingMessage, processMarkdownImages } = useImageLoader()
const {
  documentTags,
  showModal,
  loadTags,
  addTag,
  removeTag,
  getTagColor,
  openModal,
  closeModal
} = useTags()
const { highlightChunk } = useHighlight()

// 数据
const data = ref(null)
const searchQuery = ref('')
const tagInput = ref('')
const documentName = ref('-')
const currentDocument = ref('')
const isProcessing = ref(false)
const processingFilename = ref('')
const showSemanticSearch = ref(false)
const showGlobalTagManager = ref(false)

// 处理后的chunks（包含图片处理）
const processedChunks = ref([])

// 引用
const chunksPanelRef = ref(null)

async function loadData(jsonPath, filename = null) {
  try {
    let jsonData

    // 优先从数据库 API 加载（如果提供了 filename）
    if (filename) {
      try {
        const apiUrl = `http://localhost:8000/api/documents/${encodeURIComponent(filename)}/chunks`
        console.log('🔍 尝试从数据库加载:', apiUrl)
        const apiResponse = await fetch(apiUrl)
        if (apiResponse.ok) {
          const responseText = await apiResponse.text()
          // 检查响应是否为 JSON
          if (responseText.trim().startsWith('{') || responseText.trim().startsWith('[')) {
            jsonData = JSON.parse(responseText)
            console.log('✅ 从数据库加载 chunks，共', jsonData.chunks?.length, '个')
            console.log('📌 第一个 chunk 的 ID:', jsonData.chunks[0]?.id)
          } else {
            throw new Error('响应不是有效的 JSON 格式')
          }
        } else {
          const errorText = await apiResponse.text()
          throw new Error(`Database API failed: ${errorText}`)
        }
      } catch (dbError) {
        console.warn('⚠️  数据库加载失败，回退到 JSON 文件:', dbError.message)
        // 回退到 JSON 文件
        if (jsonPath) {
          const response = await fetch(jsonPath)
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
          const responseText = await response.text()
          if (responseText.trim().startsWith('{') || responseText.trim().startsWith('[')) {
            jsonData = JSON.parse(responseText)
            console.log('📄 从 JSON 文件加载 chunks')
          } else {
            throw new Error('JSON 文件响应不是有效的 JSON 格式')
          }
        } else {
          throw new Error('没有可用的数据源')
        }
      }
    } else if (jsonPath) {
      // 直接从 JSON 文件加载
      const response = await fetch(jsonPath)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const responseText = await response.text()
      if (responseText.trim().startsWith('{') || responseText.trim().startsWith('[')) {
        jsonData = JSON.parse(responseText)
      } else {
        throw new Error('响应不是有效的 JSON 格式')
      }
    } else {
      // 没有提供任何路径，静默返回
      console.log('ℹ️  没有提供数据路径，等待用户选择文档')
      return
    }

    data.value = jsonData
    documentName.value = jsonData.metadata?.source_file?.split('/').pop() || '-'

    // 直接使用原始内容，图片将通过 loading="lazy" 延迟加载
    processedChunks.value = jsonData.chunks

    if (CONFIG.showImages) {
      console.log('✅ 页面已加载，图片将延迟加载')
    }
  } catch (error) {
    console.error('数据加载失败:', error)
    // 只在有明确文档选择时才显示错误
    if (filename) {
      alert(`数据加载失败: ${error.message}`)
    } else {
      console.log('ℹ️  初始化时没有数据，等待用户选择文档')
    }
  }
}

function handleDocumentSelected(doc) {
  currentDocument.value = doc.filename
  isProcessing.value = false

  // 加载文档标签
  loadTags(doc.filename)

  // 如果处理成功，加载数据
  if (doc.status === 'processed' && doc.output_path) {
    loadData(doc.output_path, doc.filename)  // 传递 filename 参数
  } else if (doc.status === 'error') {
    // 错误情况，清空chunks
    processedChunks.value = []
    documentName.value = doc.filename
  }
}

function handleDocumentProcessing(filename) {
  currentDocument.value = filename
  documentName.value = filename
  processingFilename.value = filename
  isProcessing.value = true
  processedChunks.value = []
}

function handleAddTag(tagText) {
  const success = addTag(tagText)
  if (success) {
    tagInput.value = ''
  }
}

function handleChunkUpdated(updatedChunk) {
  // 如果没有传递 updatedChunk（批量操作），重新加载整个文档
  if (!updatedChunk) {
    console.log('🔄 批量操作完成，重新加载文档...')
    if (currentDocument.value) {
      loadData(null, currentDocument.value)
    }
    return
  }

  // 更新本地chunks数组中的对应chunk
  const index = processedChunks.value.findIndex(c => c.chunk_id === updatedChunk.chunk_id)
  if (index !== -1) {
    // 使用数据库 ID 查找（如果有）
    const dbIndex = processedChunks.value.findIndex(c => c.id === updatedChunk.id)
    const targetIndex = dbIndex !== -1 ? dbIndex : index

    // 保留原有的其他字段，只更新修改的字段
    processedChunks.value[targetIndex] = {
      ...processedChunks.value[targetIndex],
      ...updatedChunk
    }

    console.log('✅ Chunk updated in App:', updatedChunk)
    console.log('📌 Updated chunk in array:', processedChunks.value[targetIndex])
  } else {
    console.warn('⚠️  Chunk not found in processedChunks:', updatedChunk.chunk_id)
  }
}

// 处理从 DocumentPanel 点击，高亮并滚动到右侧 chunk list 或切换编辑器
function highlightChunkAndScroll(chunkId) {
  highlightChunk(chunkId, true)

  // 如果 ChunksPanel 正在编辑状态，尝试切换到点击的 chunk
  if (chunksPanelRef.value && chunksPanelRef.value.switchToChunk) {
    chunksPanelRef.value.switchToChunk(chunkId)
  }
}

// 处理从语义搜索页面查看 chunk
async function handleViewChunkFromSearch({ chunk_id, db_id, source_file, document_id, mode }) {
  // 关闭搜索页面
  showSemanticSearch.value = false

  // 加载对应文档
  if (source_file) {
    try {
      // 更新当前文档名
      currentDocument.value = source_file
      documentName.value = source_file

      // 加载文档数据
      await loadData(null, source_file)

      // 等待数据加载完成
      setTimeout(() => {
        if (mode === 'edit') {
          // 编辑模式：打开编辑器
          highlightChunkAndScroll(chunk_id)
        } else {
          // 文档模式：只高亮，不打开编辑器
          highlightChunk(chunk_id, true)
        }
      }, 300)
    } catch (error) {
      console.error('加载文档失败:', error)
      alert(`无法加载文档: ${source_file}`)
    }
  } else if (chunk_id) {
    // 如果没有文件名，尝试在当前文档中查找
    setTimeout(() => {
      if (mode === 'edit') {
        highlightChunkAndScroll(chunk_id)
      } else {
        highlightChunk(chunk_id, true)
      }
    }, 100)
  }
}

// 处理全局标签更新
function handleGlobalTagsUpdated() {
  // 重新加载当前文档（如果有）
  if (currentDocument.value) {
    loadData(null, currentDocument.value)
  }
}

onMounted(() => {
  // 如果配置中有默认路径，则加载
  if (CONFIG.jsonPath) {
    loadData(CONFIG.jsonPath)
  }
})
</script>

<style scoped>
.processing-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
  backdrop-filter: blur(4px);
}

.processing-modal {
  background: white;
  padding: 40px;
  border-radius: 12px;
  text-align: center;
  max-width: 400px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
}

.processing-spinner {
  font-size: 48px;
  animation: spin 2s linear infinite;
  margin-bottom: 20px;
}

.processing-modal h3 {
  margin: 0 0 15px 0;
  color: #2c3e50;
  font-size: 20px;
}

.processing-filename {
  color: #3498db;
  font-weight: 500;
  margin: 10px 0;
  font-size: 14px;
  word-break: break-all;
}

.processing-tip {
  color: #7f8c8d;
  font-size: 13px;
  margin: 15px 0 20px 0;
}

.processing-loader {
  width: 100%;
  height: 4px;
  background: #ecf0f1;
  border-radius: 2px;
  overflow: hidden;
}

.loader-bar {
  height: 100%;
  background: linear-gradient(90deg, #3498db, #2ecc71, #3498db);
  background-size: 200% 100%;
  animation: loading 1.5s ease-in-out infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
