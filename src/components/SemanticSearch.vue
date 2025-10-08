<template>
  <div class="semantic-search-page">
    <div class="search-header">
      <h2>🔍 向量语义搜索</h2>
      
      <!-- 统计信息 -->
      <div v-if="stats" class="stats-panel-header">
        <div class="stat-card-mini">
          <span class="stat-label-mini">总文档:</span>
          <span class="stat-value-mini documents">{{ stats.total_documents || 0 }}</span>
        </div>
        <div class="stat-card-mini">
          <span class="stat-label-mini">总 Chunks:</span>
          <span class="stat-value-mini">{{ stats.total }}</span>
        </div>
        <div class="stat-card-mini">
          <span class="stat-label-mini">总 Tokens:</span>
          <span class="stat-value-mini tokens">{{ formatNumber(stats.total_tokens || 0) }}</span>
        </div>
        <div class="stat-card-mini">
          <span class="stat-label-mini">已向量化:</span>
          <span class="stat-value-mini vectorized">{{ stats.vectorized }}</span>
        </div>
        <div class="stat-card-mini">
          <span class="stat-label-mini">待向量化:</span>
          <span class="stat-value-mini pending">{{ stats.pending }}</span>
        </div>
        <div class="stat-card-mini">
          <span class="stat-label-mini">已废弃:</span>
          <span class="stat-value-mini deprecated">{{ stats.deprecated }}</span>
        </div>
      </div>
      
      <button class="btn-back" @click="$emit('close')">← 返回文档列表</button>
    </div>

    <!-- Chunk 详情弹窗 -->
    <ChunkDetailModal
      :visible="showDetailModal"
      :chunk="currentChunk"
      :currentIndex="currentChunkIndex"
      :total="results.length"
      @close="showDetailModal = false"
      @prev="showPreviousChunk"
      @next="showNextChunk"
      @jump-to-document="handleJumpToDocument"
      @jump-to-chunk="handleJumpToChunk"
    />

    <!-- 搜索框 -->
    <div class="search-input-section">
      <div class="input-group">
        <div class="search-input-wrapper">
          <input
            v-model="query"
            @keydown.enter="search"
            @focus="showSearchHistory = true"
            @blur="handleSearchBlur"
            type="text"
            placeholder="输入查询内容，例如：如何设置显示屏分辨率？"
            class="search-input"
          />
          <!-- 搜索历史下拉框 -->
          <div v-if="showSearchHistory && searchHistory.length > 0" class="search-history-dropdown">
            <div class="history-header">
              <span class="history-title">🕒 搜索历史</span>
              <button @click.stop="clearSearchHistory" class="btn-clear-history" title="清空历史">
                🗑️
              </button>
            </div>
            <div class="history-list">
              <div
                v-for="(item, index) in searchHistory"
                :key="index"
                class="history-item"
                @mousedown.prevent="selectHistoryItem(item)"
              >
                <span class="history-icon">🔍</span>
                <span class="history-text">{{ item }}</span>
                <button
                  @mousedown.prevent.stop="removeHistoryItem(index)"
                  class="btn-remove-item"
                  title="删除"
                >
                  ×
                </button>
              </div>
            </div>
          </div>
        </div>
        <button @click="search" :disabled="searching || !query.trim()" class="btn-search">
          {{ searching ? '搜索中...' : '🔍 搜索' }}
        </button>
      </div>

      <!-- 高级选项 -->
      <div class="advanced-options">
        <label>
          返回结果数:
          <select v-model.number="topK">
            <option :value="3">3</option>
            <option :value="5">5</option>
            <option :value="10">10</option>
            <option :value="20">20</option>
          </select>
        </label>

        <label>
          <input type="checkbox" v-model="filterAtomic" />
          仅搜索非 ATOMIC 块
        </label>

        <label>
          <input type="checkbox" v-model="showMetadata" />
          显示元数据
        </label>
      </div>

      <!-- 标签过滤 -->
      <div class="tag-filter-section" v-if="availableTags.length > 0">
        <div class="filter-header">
          <span class="filter-label">🏷️ 标签过滤:</span>
          <button @click="clearTagFilters" class="btn-clear-tags" v-if="selectedTags.length > 0">
            清空 ({{ selectedTags.length }})
          </button>
        </div>
        <div class="tags-list">
          <label
            v-for="tag in availableTags"
            :key="tag"
            class="tag-checkbox"
            :class="{ selected: selectedTags.includes(tag) }"
          >
            <input
              type="checkbox"
              :value="tag"
              v-model="selectedTags"
            />
            <span class="tag-text">{{ tag }}</span>
          </label>
        </div>
      </div>
    </div>

    <!-- 搜索结果 -->
    <div class="search-results">
      <div v-if="error" class="error-message">
        ❌ {{ error }}
      </div>

      <div v-else-if="results.length === 0 && !searching && hasSearched" class="no-results">
        <p>😕 没有找到相关结果</p>
        <p class="hint">提示：确保已有 chunks 被向量化</p>
      </div>

      <div v-else-if="results.length > 0" class="results-list">
        <div class="results-header">
          找到 <strong>{{ results.length }}</strong> 个相关结果
        </div>

        <div
          v-for="(result, index) in results"
          :key="result.chunk_id || index"
          class="result-item"
        >
          <div class="result-header">
            <div class="result-rank">#{{ index + 1 }}</div>
            <div class="result-title">
              <span class="chunk-label">Chunk #{{ result.metadata?.chunk_id || result.chunk_id || '?' }}</span>
              <span v-if="result.metadata?.is_atomic" class="atomic-badge">
                ⚛️ {{ result.metadata?.atomic_type?.toUpperCase() }}
              </span>
            </div>
            <div class="result-score" :title="`相似度 = 1 - 距离 (距离: ${result.score?.toFixed(4) || 0})`">
              <span class="similarity-value" :class="getSimilarityClass(result.score)">
                {{ getSimilarityPercent(result.score) }}
              </span>
            </div>
          </div>

          <!-- 文件名（始终显示） -->
          <div class="result-filename">
            <span class="file-icon">📄</span>
            <span class="filename-text">{{ result.source_file || result.metadata?.source_file || '未知文件' }}</span>
          </div>

          <div class="result-meta" v-if="showMetadata && result.metadata">
            <span class="meta-item" v-if="result.metadata.user_tag">
              🏷️ {{ result.metadata.user_tag }}
            </span>
            <span class="meta-item">
              📊 {{ result.metadata.token_count || 0 }} tokens
            </span>
          </div>

          <div class="result-tags" v-if="hasAnyTags(result.metadata)">
            <!-- 用户标签（章节标题，蓝色） -->
            <span
              v-if="result.metadata?.user_tag && result.metadata.user_tag !== 'none'"
              class="tag user-tag"
              title="章节标题"
            >
              📑 {{ result.metadata.user_tag }}
            </span>

            <!-- 文档标签（橙色，共性标签） -->
            <span
              v-for="tag in getDocumentTags(result.metadata)"
              :key="'doc-' + tag"
              class="tag doc-tag"
              title="文档级别标签"
            >
              📚 {{ tag }}
            </span>

            <!-- 内容标签（绿色，chunk 特有标签） -->
            <span
              v-for="tag in getContentOnlyTags(result.metadata)"
              :key="'content-' + tag"
              class="tag content-tag"
              title="内容标签"
            >
              🏷️ {{ tag }}
            </span>
          </div>

          <div class="result-content">
            <div class="content-preview" v-html="renderMarkdown(result.content)"></div>
          </div>

          <div class="result-actions">
            <button @click="viewChunkDetail(index)" class="btn-view">
              查看完整内容
            </button>
          </div>
        </div>
      </div>

      <div v-else-if="!hasSearched" class="search-hint">
        <p>💡 在上方输入框中输入查询内容开始搜索</p>
        <p class="examples">
          示例查询：
          <span class="example-query" @click="setQuery('显示屏参数')">显示屏参数</span>
          <span class="example-query" @click="setQuery('安装步骤')">安装步骤</span>
          <span class="example-query" @click="setQuery('电源要求')">电源要求</span>
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { marked } from 'marked'
import { onMounted, ref } from 'vue'
import { CONFIG } from '../utils/config'
import ChunkDetailModal from './ChunkDetailModal.vue'

const emit = defineEmits(['close', 'view-chunk'])

// 搜索状态
const query = ref('')
const topK = ref(5)
const filterAtomic = ref(false)
const showMetadata = ref(true)
const searching = ref(false)
const hasSearched = ref(false)
const error = ref(null)
const results = ref([])
const stats = ref(null)

// 标签过滤
const availableTags = ref([])
const selectedTags = ref([])

// 弹窗状态
const showDetailModal = ref(false)
const currentChunk = ref(null)
const currentChunkIndex = ref(0)

// 搜索历史
const SEARCH_HISTORY_KEY = 'semantic_search_history'
const MAX_HISTORY_ITEMS = 10
const searchHistory = ref([])
const showSearchHistory = ref(false)

// 搜索历史管理
function loadSearchHistory() {
  try {
    const history = localStorage.getItem(SEARCH_HISTORY_KEY)
    if (history) {
      searchHistory.value = JSON.parse(history)
    }
  } catch (e) {
    console.error('加载搜索历史失败:', e)
    searchHistory.value = []
  }
}

function saveSearchHistory() {
  try {
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(searchHistory.value))
  } catch (e) {
    console.error('保存搜索历史失败:', e)
  }
}

function addToSearchHistory(queryText) {
  const trimmedQuery = queryText.trim()
  if (!trimmedQuery) return

  // 移除重复项（如果存在）
  searchHistory.value = searchHistory.value.filter(item => item !== trimmedQuery)
  
  // 添加到开头
  searchHistory.value.unshift(trimmedQuery)
  
  // 限制历史记录数量
  if (searchHistory.value.length > MAX_HISTORY_ITEMS) {
    searchHistory.value = searchHistory.value.slice(0, MAX_HISTORY_ITEMS)
  }
  
  saveSearchHistory()
}

function selectHistoryItem(item) {
  query.value = item
  showSearchHistory.value = false
  search()
}

function removeHistoryItem(index) {
  searchHistory.value.splice(index, 1)
  saveSearchHistory()
}

function clearSearchHistory() {
  searchHistory.value = []
  saveSearchHistory()
  showSearchHistory.value = false
}

function handleSearchBlur() {
  // 延迟隐藏，以便点击事件能触发
  setTimeout(() => {
    showSearchHistory.value = false
  }, 200)
}

// 获取统计信息
async function loadStats() {
  try {
    const response = await fetch(`${CONFIG.baseURL}/api/vectorization/stats`)
    if (response.ok) {
      stats.value = await response.json()
    }
  } catch (e) {
    console.error('获取统计信息失败:', e)
  }
}

// 加载所有可用标签
async function loadTags() {
  try {
    const response = await fetch(`${CONFIG.baseURL}/api/chunks/tags`)
    if (response.ok) {
      const data = await response.json()
      availableTags.value = data.tags || []
    }
  } catch (e) {
    console.error('获取标签失败:', e)
  }
}

// 清空标签过滤
function clearTagFilters() {
  selectedTags.value = []
}

// 搜索
async function search() {
  if (!query.value.trim()) return

  searching.value = true
  hasSearched.value = true
  error.value = null
  results.value = []
  showSearchHistory.value = false

  try {
    const filters = {}
    if (filterAtomic.value) {
      filters.is_atomic = false
    }

    // 添加标签过滤
    if (selectedTags.value.length > 0) {
      filters.content_tags = selectedTags.value
    }

    const response = await fetch(`${CONFIG.baseURL}/api/chunks/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: query.value,
        top_k: topK.value,
        filters: Object.keys(filters).length > 0 ? filters : null
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.detail || '搜索失败')
    }

    const data = await response.json()

    // 解析 metadata 中的 JSON 字符串
    results.value = data.map(item => ({
      ...item,
      source_file: item.metadata.source_file || '未知文件',
      metadata: {
        ...item.metadata,
        content_tags: parseJSON(item.metadata.content_tags),
        document_tags: parseJSON(item.metadata.document_tags),
        is_atomic: Boolean(item.metadata.is_atomic),
        token_count: item.metadata.token_count || 0
      }
    }))

    // 搜索成功后添加到历史记录
    addToSearchHistory(query.value)

  } catch (e) {
    console.error('搜索失败:', e)
    error.value = e.message
  } finally {
    searching.value = false
  }
}

// 解析 JSON 字符串
function parseJSON(str) {
  try {
    return typeof str === 'string' ? JSON.parse(str) : str
  } catch {
    return []
  }
}

// 检查是否有任何标签
function hasAnyTags(metadata) {
  if (!metadata) return false
  const userTag = metadata.user_tag && metadata.user_tag !== 'none'
  const docTags = getDocumentTags(metadata).length > 0
  const contentTags = getContentOnlyTags(metadata).length > 0
  return userTag || docTags || contentTags
}

// 获取文档标签
function getDocumentTags(metadata) {
  if (!metadata) return []
  return metadata.document_tags || []
}

// 获取 chunk 独有的内容标签（排除文档标签）
function getContentOnlyTags(metadata) {
  if (!metadata) return []
  const contentTags = metadata.content_tags || []
  const documentTags = metadata.document_tags || []

  // 返回 content_tags 中不在 document_tags 中的标签
  return contentTags.filter(tag => !documentTags.includes(tag))
}

// 计算相似度（使用 Milvus 官方的 L2 归一化公式）
// 对于 L2 距离: normalized_score = 1.0 - (2 × arctan(score)) / π
// 参考: https://milvus.io/docs/metric.md
function getSimilarityPercent(score) {
  if (!score && score !== 0) return '-'

  // Milvus L2 距离的归一化公式
  const similarity = 1.0 - (2 * Math.atan(score)) / Math.PI

  // 限制在 0-1 范围内
  const bounded = Math.max(0, Math.min(1, similarity))
  return bounded.toFixed(3)
}

// 根据相似度返回 CSS 类（用于颜色）
function getSimilarityClass(score) {
  if (!score && score !== 0) return 'similarity-unknown'

  // 使用归一化后的相似度计算百分比
  const similarity = (1.0 - (2 * Math.atan(score)) / Math.PI) * 100

  if (similarity >= 80) return 'similarity-excellent'  // 绿色
  if (similarity >= 60) return 'similarity-good'       // 浅绿
  if (similarity >= 40) return 'similarity-fair'       // 黄色
  if (similarity >= 20) return 'similarity-poor'       // 橙色
  return 'similarity-bad'                               // 红色
}

// 渲染 Markdown
function renderMarkdown(content) {
  const truncated = content.length > 500 ? content.substring(0, 500) + '...' : content
  return marked.parse(truncated)
}

// 格式化数字（添加千位分隔符）
function formatNumber(num) {
  if (!num && num !== 0) return '0'
  return num.toLocaleString('en-US')
}

// 设置示例查询
function setQuery(text) {
  query.value = text
  search()
}

// 查看完整内容（弹窗）
function viewChunkDetail(index) {
  currentChunkIndex.value = index
  currentChunk.value = results.value[index]
  showDetailModal.value = true
}

// 上一个 chunk
function showPreviousChunk() {
  if (currentChunkIndex.value > 0) {
    currentChunkIndex.value--
    currentChunk.value = results.value[currentChunkIndex.value]
  }
}

// 下一个 chunk
function showNextChunk() {
  if (currentChunkIndex.value < results.value.length - 1) {
    currentChunkIndex.value++
    currentChunk.value = results.value[currentChunkIndex.value]
  }
}

// 跳转到文档（只加载文档，不打开编辑器）
function handleJumpToDocument(data) {
  showDetailModal.value = false
  emit('view-chunk', {
    ...data,
    mode: 'document'  // 标记为只查看文档模式
  })
}

// 跳转到切片编辑（打开编辑器）
function handleJumpToChunk(data) {
  showDetailModal.value = false
  emit('view-chunk', {
    ...data,
    mode: 'edit'  // 标记为编辑模式
  })
}

onMounted(() => {
  loadStats()
  loadTags()
  loadSearchHistory()
})
</script>

<style scoped>
.semantic-search-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f5f5f5;
  overflow: hidden;
}

.search-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: white;
  border-bottom: 2px solid #e0e0e0;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  gap: 24px;
}

.search-header h2 {
  margin: 0;
  font-size: 20px;
  color: #333;
  flex-shrink: 0;
}

/* Header 中的统计信息 */
.stats-panel-header {
  display: flex;
  gap: 12px;
  align-items: center;
  flex: 1;
}

.stat-card-mini {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: #f9f9f9;
  border-radius: 6px;
  border: 1px solid #e0e0e0;
  transition: all 0.2s;
}

.stat-card-mini:hover {
  background: #f0f0f0;
  border-color: #d0d0d0;
}

.stat-label-mini {
  font-size: 12px;
  color: #666;
  white-space: nowrap;
}

.stat-value-mini {
  font-size: 15px;
  font-weight: 700;
  color: #333;
}

.stat-value-mini.documents {
  color: #2196F3;
}

.stat-value-mini.tokens {
  color: #9C27B0;
}

.stat-value-mini.vectorized {
  color: #4CAF50;
}

.stat-value-mini.pending {
  color: #FF9800;
}

.stat-value-mini.deprecated {
  color: #F44336;
}

.btn-back {
  padding: 8px 16px;
  border: 1px solid #ccc;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.btn-back:hover {
  background: #f0f0f0;
}

.search-input-section {
  padding: 24px;
  background: white;
  border-bottom: 1px solid #e0e0e0;
}

.input-group {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.search-input-wrapper {
  flex: 1;
  position: relative;
}

.search-input {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #ddd;
  border-radius: 8px;
  font-size: 15px;
  transition: border-color 0.2s;
}

.search-input:focus {
  outline: none;
  border-color: #2196F3;
}

/* 搜索历史下拉框 */
.search-history-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  max-height: 300px;
  overflow: hidden;
  z-index: 1000;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  border-bottom: 1px solid #e0e0e0;
  background: #f8f9fa;
}

.history-title {
  font-size: 13px;
  font-weight: 600;
  color: #666;
}

.btn-clear-history {
  background: transparent;
  border: none;
  color: #999;
  cursor: pointer;
  font-size: 16px;
  padding: 2px 6px;
  border-radius: 4px;
  transition: all 0.2s;
}

.btn-clear-history:hover {
  background: #e0e0e0;
  color: #666;
}

.history-list {
  max-height: 250px;
  overflow-y: auto;
}

.history-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  cursor: pointer;
  transition: background 0.2s;
  border-bottom: 1px solid #f5f5f5;
}

.history-item:last-child {
  border-bottom: none;
}

.history-item:hover {
  background: #f8f9fa;
}

.history-icon {
  font-size: 14px;
  color: #999;
  flex-shrink: 0;
}

.history-text {
  flex: 1;
  font-size: 14px;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.btn-remove-item {
  background: transparent;
  border: none;
  color: #ccc;
  cursor: pointer;
  font-size: 20px;
  line-height: 1;
  padding: 0 4px;
  border-radius: 4px;
  transition: all 0.2s;
  flex-shrink: 0;
  opacity: 0;
}

.history-item:hover .btn-remove-item {
  opacity: 1;
}

.btn-remove-item:hover {
  background: #ffebee;
  color: #f44336;
}

.btn-search {
  padding: 12px 32px;
  border: none;
  background: #2196F3;
  color: white;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
  white-space: nowrap;
}

.btn-search:hover:not(:disabled) {
  background: #1976D2;
}

.btn-search:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.advanced-options {
  display: flex;
  gap: 24px;
  align-items: center;
}

.advanced-options label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #666;
}

.advanced-options select {
  padding: 4px 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.tag-filter-section {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #e0e0e0;
}

.filter-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.filter-label {
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.btn-clear-tags {
  padding: 4px 12px;
  border: 1px solid #FF9800;
  background: white;
  color: #FF9800;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
}

.btn-clear-tags:hover {
  background: #FF9800;
  color: white;
}

.tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  max-height: 120px;
  overflow-y: auto;
  padding: 4px;
}

.tag-checkbox {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid #ddd;
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.2s;
  background: white;
  font-size: 13px;
}

.tag-checkbox:hover {
  border-color: #2196F3;
  background: #f5f5f5;
}

.tag-checkbox.selected {
  background: #E3F2FD;
  border-color: #2196F3;
  color: #1976D2;
  font-weight: 500;
}

.tag-checkbox input[type="checkbox"] {
  cursor: pointer;
}

.tag-text {
  user-select: none;
}

.search-results {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.error-message {
  padding: 16px;
  background: #FFEBEE;
  color: #C62828;
  border-radius: 8px;
  border-left: 4px solid #F44336;
}

.no-results {
  text-align: center;
  padding: 48px;
  color: #666;
}

.no-results .hint {
  font-size: 14px;
  color: #999;
  margin-top: 8px;
}

.search-hint {
  text-align: center;
  padding: 48px;
  color: #666;
}

.examples {
  margin-top: 16px;
  font-size: 14px;
}

.example-query {
  display: inline-block;
  margin: 0 8px;
  padding: 4px 12px;
  background: #E3F2FD;
  color: #1976D2;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.example-query:hover {
  background: #BBDEFB;
}

.results-header {
  margin-bottom: 16px;
  font-size: 15px;
  color: #666;
}

.result-item {
  background: white;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.08);
  transition: box-shadow 0.2s;
}

.result-item:hover {
  box-shadow: 0 4px 8px rgba(0,0,0,0.12);
}

.result-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.result-filename {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: #F5F5F5;
  border-radius: 6px;
  margin-bottom: 10px;
  border-left: 3px solid #4CAF50;
}

.file-icon {
  font-size: 14px;
}

.filename-text {
  font-size: 13px;
  color: #555;
  font-weight: 500;
  font-family: 'Consolas', 'Monaco', monospace;
}

.result-rank {
  font-size: 20px;
  font-weight: 700;
  color: #2196F3;
  min-width: 40px;
}

.result-title {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
}

.chunk-label {
  font-weight: 600;
  color: #333;
}

.atomic-badge {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
}

.result-score {
  font-size: 18px;
  font-weight: 700;
}

.similarity-value {
  font-size: 16px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 6px;
  display: inline-block;
}

.similarity-excellent {
  background: #E8F5E9;
  color: #2E7D32;
  border: 1px solid #81C784;
}

.similarity-good {
  background: #F1F8E9;
  color: #558B2F;
  border: 1px solid #AED581;
}

.similarity-fair {
  background: #FFF9C4;
  color: #F57C00;
  border: 1px solid #FFD54F;
}

.similarity-poor {
  background: #FFE0B2;
  color: #E65100;
  border: 1px solid #FFB74D;
}

.similarity-bad {
  background: #FFEBEE;
  color: #C62828;
  border: 1px solid #EF5350;
}

.similarity-unknown {
  background: #F5F5F5;
  color: #757575;
  border: 1px solid #BDBDBD;
}

.result-meta {
  display: flex;
  gap: 12px;
  margin-bottom: 8px;
  font-size: 13px;
  color: #666;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.result-tags {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.tag {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.2s ease;
}

/* 用户标签（章节标题，蓝色） */
.tag.user-tag {
  background: #e3f2fd;
  color: #1976d2;
  border: 1px solid #90caf9;
  font-weight: 600;
}

/* 文档标签（橙色，共性标签） */
.tag.doc-tag {
  background: #fff3e0;
  color: #e65100;
  border: 1px solid #ffb74d;
  font-weight: 600;
}

/* 内容标签（绿色，chunk 特有） */
.tag.content-tag {
  background: #e8f5e9;
  color: #2e7d32;
  border: 1px solid #81c784;
}

.tag:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.result-content {
  margin: 12px 0;
  padding: 12px;
  background: #f9f9f9;
  border-radius: 4px;
  border-left: 3px solid #2196F3;
}

.content-preview {
  font-size: 14px;
  line-height: 1.6;
  color: #444;
}

/* Markdown 内容样式 */
.content-preview :deep(h1),
.content-preview :deep(h2),
.content-preview :deep(h3) {
  color: #2c3e50;
  font-weight: 600;
  margin: 0.5em 0;
}

.content-preview :deep(code) {
  background: #f5f5f5;
  color: #d63384;
  padding: 0.2em 0.4em;
  border-radius: 3px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 0.9em;
  border: 1px solid #e0e0e0;
}

.content-preview :deep(pre) {
  background: #f5f5f5;
  color: #333;
  padding: 0.8em;
  border-radius: 6px;
  overflow-x: auto;
  font-family: 'Consolas', 'Monaco', monospace;
  margin: 0.8em 0;
  border: 1px solid #e0e0e0;
}

.content-preview :deep(pre code) {
  background: none;
  padding: 0;
  color: inherit;
  border: none;
}

/* 图片样式控制 */
.content-preview :deep(img) {
  max-width: 100%;
  max-height: 150px;
  height: auto;
  display: block;
  margin: 0.8em auto;
  border-radius: 4px;
  cursor: pointer;
  object-fit: contain;
  background: #f5f5f5;
  border: 1px solid #e0e0e0;
}

.content-preview :deep(img:hover) {
  opacity: 0.9;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

/* 表格样式 */
.content-preview :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 0.8em 0;
  font-size: 13px;
  background: #ffffff;
  border: 1px solid #dee2e6;
}

.content-preview :deep(table td),
.content-preview :deep(table th) {
  border: 1px solid #dee2e6;
  padding: 6px 10px;
  text-align: left;
}

.content-preview :deep(table th) {
  background-color: #f8f9fa;
  font-weight: 600;
  color: #2c3e50;
}

.content-preview :deep(table tr:hover) {
  background-color: rgba(0, 0, 0, 0.02);
}

/* 列表样式 */
.content-preview :deep(ul),
.content-preview :deep(ol) {
  margin: 0.5em 0;
  padding-left: 1.5em;
}

/* 引用样式 */
.content-preview :deep(blockquote) {
  border-left: 3px solid #2196F3;
  padding-left: 0.8em;
  margin: 0.8em 0;
  color: #666;
  font-style: italic;
  background: #f5f5f5;
  padding: 0.4em 0.8em;
  border-radius: 4px;
}

/* 链接样式 */
.content-preview :deep(a) {
  color: #2196F3;
  text-decoration: none;
}

.content-preview :deep(a:hover) {
  text-decoration: underline;
  color: #1976D2;
}

.result-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.btn-view {
  padding: 6px 16px;
  border: 1px solid #2196F3;
  background: white;
  color: #2196F3;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}

.btn-view:hover {
  background: #2196F3;
  color: white;
}
</style>
