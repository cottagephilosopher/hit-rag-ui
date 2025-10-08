<template>
  <div class="panel right">
    <!-- Chunks列表视图 -->
    <template v-if="!editingChunk">
      <div class="panel-header">
        <span>🔪 切分后的 Chunks</span>
        <div class="header-stats">
          <div class="stat-item">
            <span>✂️ 切块数:</span>
            <span>{{ chunks.length }}</span>
          </div>
          <div class="stat-item">
            <span>🔢 总Tokens:</span>
            <span>{{ totalTokens }}</span>
          </div>
          <div class="stat-item">
            <span>📊 平均Tokens:</span>
            <span>{{ avgTokens }}</span>
          </div>
        </div>
      </div>

      <div class="search-box">
        <input
          type="text"
          class="search-input"
          :value="searchQuery"
          @input="$emit('update:searchQuery', $event.target.value)"
          placeholder="🔍 搜索 chunks..."
        />
      </div>

      <!-- 向量化工具栏 -->
      <div class="vectorize-toolbar">
        <div class="toolbar-left">
          <button
            class="btn-toggle-selection"
            @click="toggleSelectionMode"
            :class="{ active: selectionMode }"
          >
            {{ selectionMode ? '✅ 批量选择' : '☑️ 批量选择' }}
          </button>

          <template v-if="selectionMode">
            <button class="btn-select-all" @click="selectAll">全选</button>
            <button class="btn-clear-selection" @click="clearSelection">清空</button>
            <span class="selection-count">已选: {{ selectedChunks.size }}</span>
          </template>
        </div>

        <div class="toolbar-right">
          <button
            class="btn-filter-vectorizable"
            @click="toggleVectorizableFilter"
            :class="{ active: showVectorizableOnly }"
          >
            {{ showVectorizableOnly ? '✅ 仅可向量化' : '☑️ 仅可向量化' }}
          </button>

          <button
            v-if="selectionMode && selectedChunks.size > 0"
            class="btn-vectorize-batch"
            @click="vectorizeBatch"
            :disabled="vectorizing"
          >
            {{ vectorizing ? '向量化中...' : `📤 向量化 (${selectedChunks.size})` }}
          </button>
        </div>
      </div>

      <!-- 向量化进度 -->
      <div v-if="vectorizeProgress.show" class="vectorize-progress">
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: vectorizeProgress.percent + '%' }"></div>
        </div>
        <div class="progress-text">
          {{ vectorizeProgress.text }}
        </div>
      </div>

      <div class="panel-content">
        <div v-if="displayedChunks.length === 0" class="empty-state">
          <div class="empty-icon">🔪</div>
          <p class="empty-title">暂无切片数据</p>
          <p class="empty-text">{{ chunks.length === 0 ? '请从左侧选择一个文档查看' : '没有匹配的切片' }}</p>
        </div>
        <div v-else id="chunks-container">
          <ChunkCard
            v-for="(chunk, index) in displayedChunks"
            :key="chunk.chunk_id"
            :chunk="chunk"
            :color="getChunkColor(index)"
            :selected="selectedChunks.has(chunk.id)"
            :selection-mode="selectionMode"
            @click="handleChunkClick(chunk)"
          />
        </div>
      </div>
    </template>

    <!-- 编辑器视图 -->
    <ChunkEditor
      v-if="editingChunk"
      ref="chunkEditorRef"
      :chunk="editingChunk"
      :total-chunks="chunks.length"
      :current-index="currentChunkIndex"
      :current-document="currentDocument"
      @close="closeEditor"
      @save="handleSave"
      @navigate="handleNavigate"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import ChunkCard from './ChunkCard.vue'
import ChunkEditor from './ChunkEditor.vue'
import { CONFIG } from '../utils/config'

const props = defineProps({
  chunks: Array,
  searchQuery: String,
  currentDocument: String
})

const emit = defineEmits(['update:searchQuery', 'chunk-click', 'chunk-updated'])

const editingChunk = ref(null)
const currentChunkIndex = ref(0)
const chunkEditorRef = ref(null)

// 向量化相关状态
const selectionMode = ref(false)
const selectedChunks = ref(new Set())
const showVectorizableOnly = ref(false)
const vectorizing = ref(false)
const vectorizeProgress = ref({
  show: false,
  percent: 0,
  text: ''
})

const filteredChunks = computed(() => {
  if (!props.searchQuery) return props.chunks

  const query = props.searchQuery.toLowerCase()
  return props.chunks.filter(chunk =>
    chunk.content?.toLowerCase().includes(query) ||
    chunk.user_tag?.toLowerCase().includes(query) ||
    chunk.content_tags?.some(tag => tag.toLowerCase().includes(query))
  )
})

const displayedChunks = computed(() => {
  let result = filteredChunks.value

  // 过滤仅可向量化的chunks
  if (showVectorizableOnly.value) {
    result = result.filter(chunk =>
      chunk.status !== -1 && chunk.status !== 2
    )
  }

  return result
})

const totalTokens = computed(() => {
  return props.chunks.reduce((sum, chunk) => sum + (chunk.token_count || 0), 0)
})

const avgTokens = computed(() => {
  if (props.chunks.length === 0) return 0
  return Math.round(totalTokens.value / props.chunks.length)
})

function getChunkColor(index) {
  return CONFIG.colors[index % CONFIG.colors.length]
}

// 向量化工具栏功能
function toggleSelectionMode() {
  selectionMode.value = !selectionMode.value
  if (!selectionMode.value) {
    clearSelection()
  }
}

function selectAll() {
  selectedChunks.value = new Set(
    displayedChunks.value
      .filter(c => c.status !== -1 && c.status !== 2)
      .map(c => c.id)
  )
}

function clearSelection() {
  selectedChunks.value.clear()
}

function toggleVectorizableFilter() {
  showVectorizableOnly.value = !showVectorizableOnly.value
}

async function vectorizeBatch() {
  if (selectedChunks.value.size === 0) return

  vectorizing.value = true
  vectorizeProgress.value = {
    show: true,
    percent: 0,
    text: '准备向量化...'
  }

  try {
    const chunkIds = Array.from(selectedChunks.value)

    console.log('🔍 准备向量化的 chunk IDs:', chunkIds)

    // 获取文档标签
    const documentTags = props.currentDocument
      ? await fetchDocumentTags(props.currentDocument)
      : []

    console.log('🏷️ 文档标签:', documentTags)

    const response = await fetch(`${CONFIG.baseURL}/api/chunks/vectorize/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chunk_ids: chunkIds,
        document_tags: documentTags
      })
    })

    if (!response.ok) {
      // 尝试获取详细错误信息
      let errorDetail = response.statusText
      try {
        const errorData = await response.json()
        errorDetail = errorData.detail || errorDetail
      } catch (e) {
        // 无法解析错误响应
      }
      throw new Error(`向量化失败: ${errorDetail}`)
    }

    const result = await response.json()

    console.log('✅ 向量化结果:', result)

    vectorizeProgress.value = {
      show: true,
      percent: 100,
      text: `✅ 成功: ${result.success_count} | ❌ 失败: ${result.failed_count} | ⏭️ 跳过: ${result.skipped_count}`
    }

    // 通知父组件刷新数据
    emit('chunk-updated')

    // 清空选择
    clearSelection()

    // 3秒后隐藏进度条
    setTimeout(() => {
      vectorizeProgress.value.show = false
    }, 3000)

  } catch (error) {
    console.error('批量向量化失败:', error)

    vectorizeProgress.value = {
      show: true,
      percent: 0,
      text: `❌ 错误: ${error.message}`
    }

    setTimeout(() => {
      vectorizeProgress.value.show = false
    }, 3000)
  } finally {
    vectorizing.value = false
  }
}

async function fetchDocumentTags(filename) {
  try {
    const response = await fetch(`${CONFIG.baseURL}/api/documents/${filename}/tags`)
    if (!response.ok) return []
    const data = await response.json()
    return data.tags || []
  } catch (error) {
    console.error('获取文档标签失败:', error)
    return []
  }
}

function handleChunkClick(chunk) {
  if (selectionMode.value) {
    // 批量选择模式：切换选中状态
    if (chunk.status === -1 || chunk.status === 2) {
      return // 废弃或已向量化的不能选中
    }

    if (selectedChunks.value.has(chunk.id)) {
      selectedChunks.value.delete(chunk.id)
    } else {
      selectedChunks.value.add(chunk.id)
    }
  } else {
    // 正常模式：打开编辑器
    openEditor(chunk)
  }
}

function openEditor(chunkData) {
  console.log('📂 打开编辑器，chunk 数据:', {
    chunk_id: chunkData.chunk_id,
    id: chunkData.id,
    user_tag: chunkData.user_tag,
    content_tags: chunkData.content_tags
  })

  // chunkData现在是完整的chunk对象
  editingChunk.value = { ...chunkData }

  // 找到当前chunk在chunks数组中的索引
  currentChunkIndex.value = props.chunks.findIndex(c => c.chunk_id === chunkData.chunk_id)

  console.log('📌 Chunk 在数组中的索引:', currentChunkIndex.value)

  // 触发原来的chunk-click事件（用于高亮）
  emit('chunk-click', chunkData.chunk_id)
}

function closeEditor() {
  editingChunk.value = null
}

function handleSave(updatedChunk) {
  console.log('📝 ChunksPanel 收到保存事件:', updatedChunk)

  // 通知父组件chunk已更新
  emit('chunk-updated', updatedChunk)

  console.log('✅ 已通知父组件更新 chunk')

  // 关闭编辑器
  closeEditor()
}

function handleNavigate(newIndex) {
  // 切换到指定索引的chunk
  if (newIndex >= 0 && newIndex < props.chunks.length) {
    const nextChunk = props.chunks[newIndex]
    editingChunk.value = { ...nextChunk }
    currentChunkIndex.value = newIndex

    // 触发高亮事件
    emit('chunk-click', nextChunk.chunk_id)
  }
}

// 监听文档切换，关闭编辑器
watch(() => props.currentDocument, () => {
  if (editingChunk.value) {
    closeEditor()
  }
})

// 暴露方法给父组件：从外部切换到指定 chunk
function switchToChunk(chunkId) {
  // 如果当前没有打开编辑器，直接打开
  if (!editingChunk.value) {
    const chunk = props.chunks.find(c => c.chunk_id === chunkId)
    if (chunk) {
      openEditor(chunk)
    }
    return
  }

  // 如果正在编辑其他 chunk，需要检查是否有未保存的修改
  if (editingChunk.value.chunk_id === chunkId) {
    // 已经是当前 chunk，不需要切换
    return
  }

  // 检查是否有未保存的修改
  if (chunkEditorRef.value && chunkEditorRef.value.confirmAndSwitch) {
    const canSwitch = chunkEditorRef.value.confirmAndSwitch(chunkId)
    if (!canSwitch) {
      return // 用户取消切换
    }
  }

  // 切换到新的 chunk
  const chunk = props.chunks.find(c => c.chunk_id === chunkId)
  if (chunk) {
    openEditor(chunk)
  }
}

defineExpose({
  switchToChunk
})
</script>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #95a5a6;
  padding: 40px 20px;
  text-align: center;
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 20px;
  opacity: 0.5;
}

.empty-title {
  font-size: 18px;
  font-weight: 600;
  color: #7f8c8d;
  margin: 0 0 10px 0;
}

.empty-text {
  font-size: 14px;
  color: #95a5a6;
  margin: 0;
}

.vectorize-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #f5f5f5;
  border-bottom: 1px solid #ddd;
  gap: 8px;
}

.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-toggle-selection,
.btn-filter-vectorizable {
  padding: 6px 12px;
  border: 1px solid #ccc;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}

.btn-toggle-selection.active,
.btn-filter-vectorizable.active {
  background: #4CAF50;
  color: white;
  border-color: #4CAF50;
}

.btn-select-all,
.btn-clear-selection {
  padding: 4px 10px;
  border: 1px solid #ccc;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.btn-select-all:hover,
.btn-clear-selection:hover {
  background: #f0f0f0;
}

.selection-count {
  font-size: 13px;
  color: #666;
  font-weight: 500;
}

.btn-vectorize-batch {
  padding: 6px 16px;
  border: none;
  background: #2196F3;
  color: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: background 0.2s;
}

.btn-vectorize-batch:hover:not(:disabled) {
  background: #1976D2;
}

.btn-vectorize-batch:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.vectorize-progress {
  padding: 8px 12px;
  background: #f9f9f9;
  border-bottom: 1px solid #ddd;
}

.progress-bar {
  width: 100%;
  height: 20px;
  background: #e0e0e0;
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 4px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #4CAF50, #8BC34A);
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 12px;
  color: #666;
  text-align: center;
}
</style>
