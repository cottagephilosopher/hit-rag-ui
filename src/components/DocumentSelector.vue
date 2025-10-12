<template>
  <div class="panel selector" :class="{ collapsed: isCollapsed }">
    <div v-if="!isCollapsed" class="panel-header">
      📂 MDList
      <div style="display: flex; gap: 8px;">
        <button @click="$router.push('/config')" class="config-btn" title="RAG 配置">
          ⚙️
        </button>
        <button @click="$emit('open-chat')" class="chat-btn" title="智能对话">
          💬
        </button>
        <button @click="$emit('open-tag-manager')" class="tag-manager-btn" title="标签管理">
          🏷️
        </button>
        <button @click="$emit('open-search')" class="search-btn" title="向量语义搜索">
          🔍
        </button>
        <button @click="refreshDocuments" class="refresh-btn-small" :disabled="loading" hidden>
          {{ loading ? '🔄' : '🔄' }}
        </button>
        <button @click="toggleCollapse" class="collapse-btn" title="收起">
          ◀
        </button>
      </div>
    </div>

    <div v-if="isCollapsed" class="collapsed-tab" @click="toggleCollapse">
      <span class="tab-text">📂 MDList</span>
    </div>

    <div v-if="!isCollapsed" class="search-box">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="搜索文档..."
        class="search-input"
      />
    </div>

    <div v-if="!isCollapsed" class="panel-content" style="padding: 0;">
      <div class="documents-list">
        <div
          v-for="doc in filteredDocuments"
          :key="doc.filename"
          class="document-item"
          :class="{
            'selected': currentDocument === doc.filename,
            'processing': doc.status === 'processing',
            'error': doc.status === 'error'
          }"
          @click="selectDocument(doc)"
        >
          <div class="doc-info">
            <div class="doc-name">{{ doc.filename }}</div>
            <div class="doc-status">
              <span class="status-badge" :class="doc.status">
                {{ getStatusText(doc.status) }}
              </span>
            </div>
          </div>

          <div v-if="doc.status === 'processing'" class="doc-actions">
            <span class="processing-spinner">⏳</span>
          </div>

          <div v-else-if="doc.status === 'error'" class="doc-actions">
            <button @click.stop="reprocessDocument(doc)" class="action-btn retry">
              重试
            </button>
          </div>

          <div v-else-if="doc.status === 'not_processed'" class="doc-actions">
            <button @click.stop="processDocument(doc)" class="action-btn process">
              处理
            </button>
          </div>

          <div v-else-if="doc.status === 'processed'" class="doc-actions">
            <button @click.stop="deleteOutput(doc)" class="action-btn delete" title="删除切片">
              删除
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps({
  currentDocument: String
})

const emit = defineEmits(['document-selected', 'document-processing', 'open-search', 'open-tag-manager', 'open-chat'])

import { API_BASE } from '@/utils/config'

const router = useRouter()

const documents = ref([])
const loading = ref(false)
const searchQuery = ref('')
const isCollapsed = ref(false)

const filteredDocuments = computed(() => {
  if (!searchQuery.value) return documents.value
  const query = searchQuery.value.toLowerCase()
  return documents.value.filter(doc =>
    doc.filename.toLowerCase().includes(query)
  )
})

function toggleCollapse() {
  isCollapsed.value = !isCollapsed.value
}

async function refreshDocuments() {
  loading.value = true
  try {
    const response = await fetch(`${API_BASE}/documents`)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    documents.value = await response.json()
  } catch (error) {
    console.error('获取文档列表失败:', error)
    alert(`获取文档列表失败: ${error.message}`)
  } finally {
    loading.value = false
  }
}

function selectDocument(doc) {
  if (doc.status === 'processed') {
    emit('document-selected', doc)
  } else if (doc.status === 'not_processed') {
    processDocument(doc)
  }
}

async function processDocument(doc) {
  try {
    emit('document-processing', doc.filename)

    const response = await fetch(`${API_BASE}/documents/${encodeURIComponent(doc.filename)}/process`, {
      method: 'POST'
    })

    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    // 开始轮询状态
    pollDocumentStatus(doc.filename)
  } catch (error) {
    console.error('触发处理失败:', error)
    alert(`触发处理失败: ${error.message}`)
  }
}

async function deleteOutput(doc) {
  if (!confirm(`确定要删除 "${doc.filename}" 的切片输出吗？\n删除后需要重新处理才能查看。`)) return

  try {
    const response = await fetch(`${API_BASE}/documents/${encodeURIComponent(doc.filename)}/output`, {
      method: 'DELETE'
    })

    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    // 刷新文档列表
    await refreshDocuments()

    // 如果删除的是当前选中的文档，清空显示
    if (props.currentDocument === doc.filename) {
      emit('document-selected', { filename: '', status: 'deleted' })
    }

    alert('✅ 切片输出已删除')
  } catch (error) {
    console.error('删除失败:', error)
    alert(`删除失败: ${error.message}`)
  }
}

async function reprocessDocument(doc) {
  if (!confirm(`确定要重新处理 "${doc.filename}" 吗？`)) return

  try {
    // 先删除旧的输出
    await fetch(`${API_BASE}/documents/${encodeURIComponent(doc.filename)}/output`, {
      method: 'DELETE'
    })

    // 重新处理
    await processDocument(doc)
  } catch (error) {
    console.error('重新处理失败:', error)
    alert(`重新处理失败: ${error.message}`)
  }
}

async function pollDocumentStatus(filename) {
  const pollInterval = setInterval(async () => {
    try {
      const response = await fetch(`${API_BASE}/documents/${encodeURIComponent(filename)}/status`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const status = await response.json()

      // 更新文档列表中的状态
      const index = documents.value.findIndex(d => d.filename === filename)
      if (index !== -1) {
        documents.value[index] = status
      }

      // 如果处理完成，停止轮询并加载文档
      if (status.status === 'processed') {
        clearInterval(pollInterval)
        emit('document-selected', status)
      } else if (status.status === 'error') {
        clearInterval(pollInterval)
        // 通过emit一个特殊事件来关闭loading并显示错误
        emit('document-selected', { filename, status: 'error', error: status.error })
        alert(`处理失败: ${status.error}`)
      }
    } catch (error) {
      console.error('查询状态失败:', error)
      clearInterval(pollInterval)
      emit('document-selected', { filename, status: 'error', error: error.message })
    }
  }, 2000) // 每2秒查询一次
}

function getStatusText(status) {
  const statusMap = {
    'processed': '✅ 已处理',
    'processing': '⏳ 处理中',
    'not_processed': '⭕ 未处理',
    'error': '❌ 错误'
  }
  return statusMap[status] || status
}

onMounted(() => {
  refreshDocuments()
})
</script>

<style scoped>
.panel.selector {
  transition: flex 0.3s ease, min-width 0.3s ease, max-width 0.3s ease;
}

.panel.selector.collapsed {
  flex: 0 0 40px;
  min-width: 40px;
  max-width: 40px;
}

.collapsed-tab {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  background: #34495e;
  color: white;
  padding: 40px 8px;
  cursor: pointer;
  border-radius: 0 8px 8px 0;
  writing-mode: vertical-lr;
  transition: background 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.collapsed-tab:hover {
  background: #2c3e50;
}

.tab-text {
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
}

.collapse-btn {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  cursor: pointer;
  font-size: 14px;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background 0.2s;
  font-weight: bold;
}

.collapse-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

.tag-manager-btn {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.5);
  color: white;
  cursor: pointer;
  font-size: 16px;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s;
  font-weight: bold;
}

.tag-manager-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  border-color: rgba(255, 255, 255, 0.8);
  transform: scale(1.05);
}

.search-btn {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.5);
  color: white;
  cursor: pointer;
  font-size: 16px;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s;
  font-weight: bold;
}

.search-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  border-color: rgba(255, 255, 255, 0.8);
  transform: scale(1.05);
}

.config-btn {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.5);
  color: white;
  cursor: pointer;
  font-size: 16px;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s;
  font-weight: bold;
}

.config-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  border-color: rgba(255, 255, 255, 0.8);
  transform: scale(1.05);
}

.chat-btn {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.5);
  color: white;
  cursor: pointer;
  font-size: 16px;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s;
  font-weight: bold;
}

.chat-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  border-color: rgba(255, 255, 255, 0.8);
  transform: scale(1.05);
}

.documents-list {
  height: 100%;
  overflow-y: auto;
}

.document-item {
  padding: 12px;
  border-bottom: 1px solid #e1e8ed;
  cursor: pointer;
  transition: background 0.2s;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.document-item:hover {
  background: #f8f9fa;
}

.document-item.selected {
  background: #e3f2fd;
  border-left: 3px solid #2196f3;
}

.document-item.processing {
  background: #fff3e0;
}

.document-item.error {
  background: #ffebee;
}

.doc-info {
  flex: 1;
  min-width: 0;
}

.doc-name {
  font-size: 13px;
  color: #2c3e50;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 4px;
}

.doc-status {
  font-size: 12px;
}

.status-badge {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
}

.status-badge.processed {
  background: #d4edda;
  color: #155724;
}

.status-badge.processing {
  background: #fff3cd;
  color: #856404;
}

.status-badge.not_processed {
  background: #e2e3e5;
  color: #383d41;
}

.status-badge.error {
  background: #f8d7da;
  color: #721c24;
}

.doc-actions {
  margin-left: 10px;
}

.action-btn {
  padding: 4px 10px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 11px;
  font-weight: 500;
}

.action-btn.process {
  background: #28a745;
  color: white;
}

.action-btn.process:hover {
  background: #218838;
}

.action-btn.retry {
  background: #ffc107;
  color: #000;
}

.action-btn.retry:hover {
  background: #e0a800;
}

.action-btn.delete {
  background: #f8f9fa;
  color: #dc3545;
  border: 1px solid #dc3545;
  padding: 4px 10px;
}

.action-btn.delete:hover {
  background: #dc3545;
  color: white;
}

.processing-spinner {
  font-size: 16px;
  animation: spin 2s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.refresh-btn-small {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  cursor: pointer;
  font-size: 14px;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background 0.2s;
}

.refresh-btn-small:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.3);
}

.refresh-btn-small:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
