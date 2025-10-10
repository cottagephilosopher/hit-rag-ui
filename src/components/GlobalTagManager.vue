<template>
  <div v-if="show" class="tag-manager-overlay" @click.self="close">
    <div class="tag-manager-modal">
      <!-- Header -->
      <div class="header">
        <h2>🏷️ 全局标签管理</h2>
        <button @click="close" class="close-btn">×</button>
      </div>

      <!-- 搜索栏和排序 -->
      <div class="toolbar">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="搜索标签..."
          class="search-input"
        />
        <select v-model="sortBy" class="sort-select">
          <option value="count">按使用次数</option>
          <option value="name">按名称 A-Z</option>
          <option value="type">按类型</option>
        </select>
      </div>

      <!-- 统计信息 -->
      <div v-if="!loading" class="stats-bar">
        <div class="stats-left">
          <span>共 {{ filteredTags.length }} 个标签</span>
          <span v-if="selectedTags.length > 0" class="selected-count">
            已选择 {{ selectedTags.length }} 个
          </span>
        </div>
        <button @click="showAddTagDialog" class="add-tag-btn">
          ➕ 添加标签
        </button>
      </div>

      <!-- 加载状态 -->
      <div v-if="loading" class="loading-state">
        <div class="spinner">⏳</div>
        <p>加载标签中...</p>
      </div>

      <!-- 标签列表 -->
      <div v-else class="tag-list">
        <div
          v-for="tag in filteredTags"
          :key="tag.name"
          class="tag-item"
          :class="{ selected: isSelected(tag.name) }"
        >
          <!-- 选择框 -->
          <input
            type="checkbox"
            :checked="isSelected(tag.name)"
            @change="toggleSelect(tag.name)"
            class="tag-checkbox"
          />

          <!-- 标签信息 -->
          <div class="tag-info">
            <span class="tag-name">{{ tag.name }}</span>
            <span class="tag-badge" :class="`type-${tag.type}`">
              {{ getTypeLabel(tag.type) }}
            </span>
            <span class="tag-count">{{ tag.count }} 个切片</span>
          </div>

          <!-- 操作按钮 -->
          <div class="tag-actions">
            <button @click="startRename(tag)" class="action-btn rename-btn" title="重命名">
              ✏️
            </button>
            <button @click="confirmDelete(tag)" class="action-btn delete-btn" title="删除">
              🗑️
            </button>
          </div>
        </div>

        <div v-if="filteredTags.length === 0" class="empty-state">
          <p>{{ searchQuery ? '没有找到匹配的标签' : '暂无标签' }}</p>
        </div>
      </div>

      <!-- 批量操作面板 -->
      <div v-if="selectedTags.length > 0" class="batch-panel">
        <div class="batch-header">
          <h3>批量操作 ({{ selectedTags.length }} 个标签)</h3>
          <button @click="clearSelection" class="clear-btn">清除选择</button>
        </div>

        <!-- 批量操作按钮 -->
        <div class="batch-actions">
          <button
            @click="showBatchDeleteConfirm"
            class="batch-action-btn delete-batch-btn"
            :disabled="selectedTags.length === 0"
          >
            🗑️ 批量删除
          </button>
          <button
            @click="toggleMergeMode"
            class="batch-action-btn merge-batch-btn"
            :disabled="selectedTags.length < 2"
          >
            🔗 {{ mergeMode ? '取消合并' : '合并标签' }}
          </button>
        </div>

        <!-- 合并模式 -->
        <div v-if="mergeMode" class="merge-section">
          <p class="merge-hint">
            将选中的 {{ selectedTags.length }} 个标签合并为：
          </p>
          <div class="merge-input-group">
            <input
              v-model="mergeTargetName"
              type="text"
              placeholder="输入合并后的标签名"
              class="merge-input"
              @keypress.enter="executeMerge"
            />
            <button
              @click="executeMerge"
              :disabled="!mergeTargetName.trim() || selectedTags.length < 2"
              class="merge-btn"
            >
              确认合并
            </button>
          </div>
        </div>

        <!-- 已选择的标签预览 -->
        <div class="selected-tags-preview">
          <span v-for="tagName in selectedTags" :key="tagName" class="selected-tag">
            {{ tagName }}
          </span>
        </div>
      </div>

      <!-- 添加标签对话框 -->
      <div v-if="addTagDialog.show" class="rename-dialog">
        <h3>➕ 添加新标签</h3>
        <p class="dialog-hint">
          创建一个新的全局标签，用于标记文档切片
        </p>
        <input
          v-model="addTagDialog.tagName"
          type="text"
          placeholder="输入标签名称"
          class="rename-input"
          @keypress.enter="executeAddTag"
          ref="addTagInput"
        />
        <div class="dialog-actions">
          <button @click="cancelAddTag" class="cancel-btn">取消</button>
          <button
            @click="executeAddTag"
            :disabled="!addTagDialog.tagName.trim()"
            class="confirm-btn"
          >
            确认添加
          </button>
        </div>
      </div>

      <!-- 重命名对话框 -->
      <div v-if="renameDialog.show" class="rename-dialog">
        <h3>重命名标签</h3>
        <p class="dialog-hint">
          旧标签名: <strong>{{ renameDialog.oldName }}</strong>
        </p>
        <p class="dialog-hint">
          影响 {{ renameDialog.count }} 个切片
        </p>
        <input
          v-model="renameDialog.newName"
          type="text"
          placeholder="输入新标签名"
          class="rename-input"
          @keypress.enter="executeRename"
          ref="renameInput"
        />
        <div class="dialog-actions">
          <button @click="cancelRename" class="cancel-btn">取消</button>
          <button
            @click="executeRename"
            :disabled="!renameDialog.newName.trim()"
            class="confirm-btn"
          >
            确认重命名
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'

const props = defineProps({
  show: Boolean
})

const emit = defineEmits(['close', 'tags-updated'])

const API_BASE = 'http://localhost:8000/api'

// 数据
const tags = ref([])
const loading = ref(false)
const searchQuery = ref('')
const sortBy = ref('count')
const selectedTags = ref([])
const mergeTargetName = ref('')
const mergeMode = ref(false)

// 添加标签对话框
const addTagDialog = ref({
  show: false,
  tagName: ''
})

const addTagInput = ref(null)

// 重命名对话框
const renameDialog = ref({
  show: false,
  oldName: '',
  newName: '',
  count: 0
})

const renameInput = ref(null)

// 计算属性
const filteredTags = computed(() => {
  let result = tags.value

  // 搜索过滤
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(tag => tag.name.toLowerCase().includes(query))
  }

  // 排序
  if (sortBy.value === 'count') {
    result = [...result].sort((a, b) => b.count - a.count)
  } else if (sortBy.value === 'name') {
    result = [...result].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
  } else if (sortBy.value === 'type') {
    const typeOrder = { 'both': 0, 'user_tag': 1, 'content_tag': 2 }
    result = [...result].sort((a, b) => typeOrder[a.type] - typeOrder[b.type])
  }

  return result
})

// 监听显示状态
watch(() => props.show, (newVal) => {
  if (newVal) {
    loadTags()
    selectedTags.value = []
    mergeTargetName.value = ''
  }
})

// 监听添加标签对话框显示
watch(() => addTagDialog.value.show, async (newVal) => {
  if (newVal) {
    await nextTick()
    addTagInput.value?.focus()
  }
})

// 监听重命名对话框显示
watch(() => renameDialog.value.show, async (newVal) => {
  if (newVal) {
    await nextTick()
    renameInput.value?.focus()
  }
})

// 方法
async function loadTags() {
  loading.value = true
  try {
    const response = await fetch(`${API_BASE}/tags/all`)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    tags.value = await response.json()
  } catch (error) {
    console.error('加载标签失败:', error)
    alert(`加载标签失败: ${error.message}`)
  } finally {
    loading.value = false
  }
}

function getTypeLabel(type) {
  const labels = {
    'user_tag': '用户',
    'content_tag': '内容',
    'both': '混合'
  }
  return labels[type] || type
}

function isSelected(tagName) {
  return selectedTags.value.includes(tagName)
}

function toggleSelect(tagName) {
  const index = selectedTags.value.indexOf(tagName)
  if (index > -1) {
    selectedTags.value.splice(index, 1)
  } else {
    selectedTags.value.push(tagName)
  }
}

function clearSelection() {
  selectedTags.value = []
  mergeTargetName.value = ''
  mergeMode.value = false
}

function toggleMergeMode() {
  mergeMode.value = !mergeMode.value
  if (!mergeMode.value) {
    mergeTargetName.value = ''
  }
}

function showAddTagDialog() {
  addTagDialog.value = {
    show: true,
    tagName: ''
  }
}

function cancelAddTag() {
  addTagDialog.value.show = false
}

async function executeAddTag() {
  const tagName = addTagDialog.value.tagName.trim()

  if (!tagName) {
    alert('请输入标签名称')
    return
  }

  // 检查标签是否已存在
  if (tags.value.some(tag => tag.name === tagName)) {
    alert(`标签 "${tagName}" 已存在`)
    return
  }

  if (!confirm(`确定要创建新标签 "${tagName}" 吗？\n\n新标签将可用于标记文档切片。`)) {
    return
  }

  try {
    const response = await fetch(`${API_BASE}/tags/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag_name: tagName })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || `HTTP ${response.status}`)
    }

    const result = await response.json()
    alert(result.message)

    // 重新加载标签
    await loadTags()
    addTagDialog.value.show = false
    emit('tags-updated')
  } catch (error) {
    console.error('创建标签失败:', error)
    alert(`创建标签失败: ${error.message}`)
  }
}

function startRename(tag) {
  renameDialog.value = {
    show: true,
    oldName: tag.name,
    newName: '',
    count: tag.count
  }
}

function cancelRename() {
  renameDialog.value.show = false
}

async function executeRename() {
  const oldName = renameDialog.value.oldName
  const newName = renameDialog.value.newName.trim()

  if (!newName) return

  if (oldName === newName) {
    alert('新旧标签名称相同')
    return
  }

  if (!confirm(`确定要将标签 "${oldName}" 重命名为 "${newName}" 吗？\n这将影响 ${renameDialog.value.count} 个切片。`)) {
    return
  }

  try {
    const response = await fetch(`${API_BASE}/tags/rename`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ old_name: oldName, new_name: newName })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || `HTTP ${response.status}`)
    }

    const result = await response.json()
    alert(`✅ ${result.message}`)

    // 重新加载标签
    await loadTags()
    renameDialog.value.show = false
    emit('tags-updated')
  } catch (error) {
    console.error('重命名失败:', error)
    alert(`重命名失败: ${error.message}`)
  }
}

async function confirmDelete(tag) {
  if (!confirm(`确定要删除标签 "${tag.name}" 吗？\n这将从 ${tag.count} 个切片中删除该标签。\n此操作不可撤销！`)) {
    return
  }

  try {
    const response = await fetch(`${API_BASE}/tags/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag_name: tag.name })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || `HTTP ${response.status}`)
    }

    const result = await response.json()
    alert(`✅ ${result.message}`)

    // 重新加载标签
    await loadTags()
    emit('tags-updated')
  } catch (error) {
    console.error('删除失败:', error)
    alert(`删除失败: ${error.message}`)
  }
}

async function showBatchDeleteConfirm() {
  if (selectedTags.value.length === 0) {
    alert('请先选择要删除的标签')
    return
  }

  // 计算总影响数
  const totalChunks = selectedTags.value.reduce((sum, tagName) => {
    const tag = tags.value.find(t => t.name === tagName)
    return sum + (tag?.count || 0)
  }, 0)

  if (!confirm(
    `⚠️ 批量删除标签\n\n` +
    `将删除以下 ${selectedTags.value.length} 个标签：\n` +
    `${selectedTags.value.join(', ')}\n\n` +
    `预计影响约 ${totalChunks} 个切片\n\n` +
    `此操作不可撤销！确定要继续吗？`
  )) {
    return
  }

  try {
    let successCount = 0
    let failCount = 0
    const errors = []

    // 逐个删除标签
    for (const tagName of selectedTags.value) {
      try {
        const response = await fetch(`${API_BASE}/tags/delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tag_name: tagName })
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.detail || `HTTP ${response.status}`)
        }

        successCount++
      } catch (error) {
        failCount++
        errors.push(`${tagName}: ${error.message}`)
      }
    }

    // 显示结果
    let message = `✅ 批量删除完成\n\n成功: ${successCount} 个`
    if (failCount > 0) {
      message += `\n失败: ${failCount} 个\n\n失败详情:\n${errors.join('\n')}`
    }
    alert(message)

    // 重新加载标签并清除选择
    await loadTags()
    clearSelection()
    emit('tags-updated')
  } catch (error) {
    console.error('批量删除失败:', error)
    alert(`批量删除失败: ${error.message}`)
  }
}

async function executeMerge() {
  const targetName = mergeTargetName.value.trim()

  if (!targetName) {
    alert('请输入合并后的标签名')
    return
  }

  if (selectedTags.value.length < 2) {
    alert('至少选择 2 个标签才能合并')
    return
  }

  // 计算总影响数
  const totalChunks = selectedTags.value.reduce((sum, tagName) => {
    const tag = tags.value.find(t => t.name === tagName)
    return sum + (tag?.count || 0)
  }, 0)

  if (!confirm(
    `确定要将以下 ${selectedTags.value.length} 个标签合并为 "${targetName}" 吗？\n\n` +
    `标签: ${selectedTags.value.join(', ')}\n` +
    `预计影响约 ${totalChunks} 个切片\n\n` +
    `此操作不可撤销！`
  )) {
    return
  }

  try {
    const response = await fetch(`${API_BASE}/tags/merge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_tags: selectedTags.value,
        target_tag: targetName
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || `HTTP ${response.status}`)
    }

    const result = await response.json()
    alert(`✅ ${result.message}`)

    // 重新加载标签并清除选择
    await loadTags()
    clearSelection()
    emit('tags-updated')
  } catch (error) {
    console.error('合并失败:', error)
    alert(`合并失败: ${error.message}`)
  }
}

function close() {
  emit('close')
}
</script>

<style scoped>
.tag-manager-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 3000;
  backdrop-filter: blur(4px);
}

.tag-manager-modal {
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 800px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #e1e8ed;
}

.header h2 {
  margin: 0;
  font-size: 20px;
  color: #2c3e50;
}

.close-btn {
  background: none;
  border: none;
  font-size: 32px;
  color: #95a5a6;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  line-height: 28px;
  transition: color 0.2s;
}

.close-btn:hover {
  color: #e74c3c;
}

.toolbar {
  display: flex;
  gap: 12px;
  padding: 16px 24px;
  border-bottom: 1px solid #e1e8ed;
}

.search-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
}

.sort-select {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  background: white;
  cursor: pointer;
}

.stats-bar {
  padding: 12px 24px;
  background: #f8f9fa;
  border-bottom: 1px solid #e1e8ed;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  color: #7f8c8d;
}

.stats-left {
  display: flex;
  gap: 16px;
  align-items: center;
}

.selected-count {
  color: #3498db;
  font-weight: 600;
}

.add-tag-btn {
  background: #27ae60;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 4px;
}

.add-tag-btn:hover {
  background: #229954;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(39, 174, 96, 0.3);
}

.loading-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 60px;
}

.spinner {
  font-size: 48px;
  animation: spin 2s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.tag-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px 24px;
}

.tag-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid #e1e8ed;
  border-radius: 8px;
  margin-bottom: 8px;
  transition: all 0.2s;
}

.tag-item:hover {
  background: #f8f9fa;
  border-color: #3498db;
}

.tag-item.selected {
  background: #e3f2fd;
  border-color: #2196f3;
}

.tag-checkbox {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.tag-info {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
}

.tag-name {
  font-size: 15px;
  font-weight: 500;
  color: #2c3e50;
}

.tag-badge {
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
}

.tag-badge.type-user_tag {
  background: #d4edff;
  color: #1976d2;
}

.tag-badge.type-content_tag {
  background: #d4f4dd;
  color: #2e7d32;
}

.tag-badge.type-both {
  background: #e1d4f4;
  color: #6a1b9a;
}

.tag-count {
  font-size: 13px;
  color: #7f8c8d;
}

.tag-actions {
  display: flex;
  gap: 6px;
}

.action-btn {
  background: white;
  border: 1px solid #ddd;
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.action-btn:hover {
  transform: scale(1.1);
}

.rename-btn:hover {
  background: #fff3cd;
  border-color: #ffc107;
}

.delete-btn:hover {
  background: #ffebee;
  border-color: #e74c3c;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #95a5a6;
}

.batch-panel {
  border-top: 2px solid #3498db;
  padding: 20px 24px;
  background: #f8f9fa;
}

.batch-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.batch-header h3 {
  margin: 0;
  font-size: 16px;
  color: #2c3e50;
}

.batch-actions {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.batch-action-btn {
  flex: 1;
  padding: 10px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.delete-batch-btn {
  background: #e74c3c;
  color: white;
}

.delete-batch-btn:hover:not(:disabled) {
  background: #c0392b;
}

.merge-batch-btn {
  background: #3498db;
  color: white;
}

.merge-batch-btn:hover:not(:disabled) {
  background: #2980b9;
}

.batch-action-btn:disabled {
  background: #bdc3c7;
  cursor: not-allowed;
  opacity: 0.6;
}

.merge-section {
  margin-bottom: 16px;
  padding: 16px;
  background: white;
  border-radius: 8px;
  border: 2px solid #3498db;
}

.clear-btn {
  background: white;
  border: 1px solid #ddd;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.clear-btn:hover {
  background: #ecf0f1;
}

.merge-hint {
  font-size: 14px;
  color: #7f8c8d;
  margin: 0 0 12px 0;
}

.merge-input-group {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}

.merge-input {
  flex: 1;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
}

.merge-btn {
  background: #3498db;
  color: white;
  border: none;
  padding: 10px 24px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.merge-btn:hover:not(:disabled) {
  background: #2980b9;
}

.merge-btn:disabled {
  background: #bdc3c7;
  cursor: not-allowed;
}

.selected-tags-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.selected-tag {
  background: white;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 13px;
  color: #2c3e50;
  border: 1px solid #e1e8ed;
}

.rename-dialog {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: white;
  padding: 24px;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
  width: 90%;
  max-width: 400px;
  z-index: 10;
}

.rename-dialog h3 {
  margin: 0 0 16px 0;
  font-size: 18px;
  color: #2c3e50;
}

.dialog-hint {
  font-size: 14px;
  color: #7f8c8d;
  margin: 8px 0;
}

.dialog-hint strong {
  color: #2c3e50;
}

.rename-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  margin: 16px 0;
  box-sizing: border-box;
}

.dialog-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.cancel-btn {
  background: white;
  border: 1px solid #ddd;
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.cancel-btn:hover {
  background: #ecf0f1;
}

.confirm-btn {
  background: #3498db;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.confirm-btn:hover:not(:disabled) {
  background: #2980b9;
}

.confirm-btn:disabled {
  background: #bdc3c7;
  cursor: not-allowed;
}
</style>
