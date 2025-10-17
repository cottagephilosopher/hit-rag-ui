<template>
  <div v-if="show" class="tag-manager-overlay" @click.self="close">
    <div class="tag-manager-modal">
      <!-- Header -->
      <div class="header">
        <h2>🏷️ 标签管理</h2>
        <button @click="close" class="close-btn">×</button>
      </div>

      <!-- 标签类型切换 -->
      <div class="tab-switcher">
        <button
          :class="['tab-btn', { active: currentTab === 'system' }]"
          @click="currentTab = 'system'"
        >
          🔧 系统标签 (LLM)
        </button>
        <button
          :class="['tab-btn', { active: currentTab === 'user' }]"
          @click="currentTab = 'user'"
        >
          👤 用户标签
        </button>
        <button
          :class="['tab-btn', { active: currentTab === 'document' }]"
          @click="currentTab = 'document'"
        >
          📄 文档标签
        </button>
      </div>

      <!-- 说明文字 -->
      <div class="tab-description">
        <p v-if="currentTab === 'system'">
          💡 系统标签用于 LLM 自动生成标签时的候选列表，可在"统一标签管理"中创建或从用户标签转换而来。
        </p>
        <p v-else-if="currentTab === 'user'">
          💡 用户标签是在切片编辑时<strong>手动添加</strong>的标签（带 @ 前缀），不会用于 LLM 生成标签。可点击"转换"按钮将其变为系统标签。<br>
          <strong>注意</strong>：LLM 自动生成的标签不属于用户标签，不会在此显示。
        </p>
        <p v-else>
          💡 文档标签仅作用于文档，用于向量检索时的过滤条件，不会用于 chunk 标签生成。
        </p>
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
        </select>
      </div>

      <!-- 统计信息 -->
      <div v-if="!loading" class="stats-bar">
        <div class="stats-left">
          <span>共 {{ displayTags.length }} 个标签</span>
        </div>
        <button v-if="currentTab === 'system'" @click="showAddSystemTagDialog" class="add-tag-btn">
          ➕ 添加系统标签
        </button>
      </div>

      <!-- 加载状态 -->
      <div v-if="loading" class="loading-state">
        <div class="spinner">⏳</div>
        <p>加载标签中...</p>
      </div>

      <!-- 标签列表 -->
      <div v-else class="tag-list">
        <!-- 系统标签列表 -->
        <div
          v-for="tag in displayTags"
          :key="tag.tag_name || tag.name"
          class="tag-item"
        >
          <!-- 标签信息 -->
          <div class="tag-info">
            <span class="tag-name">{{ tag.tag_name || tag.name }}</span>
            <span v-if="currentTab === 'system'" class="tag-badge system-badge">
              {{ tag.created_by === 'converted_from_user' ? '已转换' : '系统' }}
            </span>
            <span v-else-if="currentTab === 'user'" class="tag-badge user-badge">
              {{ getTypeLabel(tag.type) }}
            </span>
            <span v-else class="tag-badge doc-badge">文档</span>
            <span class="tag-count">{{ tag.usage_count || tag.count || tag.document_count || 0 }} 次使用</span>
            <span v-if="tag.description" class="tag-description">{{ tag.description }}</span>
          </div>

          <!-- 操作按钮 -->
          <div class="tag-actions">
            <!-- 用户标签：显示转换按钮 -->
            <button
              v-if="currentTab === 'user'"
              @click="showConvertDialog(tag)"
              class="action-btn convert-btn"
              title="转换为系统标签"
            >
              🔄 转换
            </button>

            <!-- 系统标签：显示重命名和删除 -->
            <template v-if="currentTab === 'system'">
              <button @click="startRenameSystemTag(tag)" class="action-btn rename-btn" title="重命名">
                ✏️
              </button>
              <button @click="confirmDeleteSystemTag(tag)" class="action-btn delete-btn" title="删除">
                🗑️
              </button>
            </template>

            <!-- 用户标签和文档标签：显示删除 -->
            <button
              v-if="currentTab !== 'system'"
              @click="confirmDelete(tag)"
              class="action-btn delete-btn"
              title="删除"
            >
              🗑️
            </button>
          </div>
        </div>

        <div v-if="displayTags.length === 0" class="empty-state">
          <p>{{ searchQuery ? '没有找到匹配的标签' : '暂无标签' }}</p>
        </div>
      </div>

      <!-- 添加系统标签对话框 -->
      <div v-if="addSystemTagDialog.show" class="dialog-overlay" @click.self="cancelAddSystemTag">
        <div class="dialog-box">
          <h3>➕ 添加系统标签</h3>
          <p class="dialog-hint">
            系统标签将用于 LLM 自动生成标签时的候选列表
          </p>
          <input
            v-model="addSystemTagDialog.tagName"
            type="text"
            placeholder="输入标签名称"
            class="dialog-input"
            @keypress.enter="executeAddSystemTag"
            ref="addSystemTagInput"
          />
          <input
            v-model="addSystemTagDialog.description"
            type="text"
            placeholder="标签描述（可选）"
            class="dialog-input"
            @keypress.enter="executeAddSystemTag"
          />
          <div class="dialog-actions">
            <button @click="cancelAddSystemTag" class="cancel-btn">取消</button>
            <button
              @click="executeAddSystemTag"
              :disabled="!addSystemTagDialog.tagName.trim()"
              class="confirm-btn"
            >
              确认添加
            </button>
          </div>
        </div>
      </div>

      <!-- 转换用户标签对话框 -->
      <div v-if="convertDialog.show" class="dialog-overlay" @click.self="cancelConvert">
        <div class="dialog-box">
          <h3>🔄 转换为系统标签</h3>
          <p class="dialog-hint">
            将用户标签 <strong>{{ convertDialog.tagName }}</strong> 转换为系统标签后，
            该标签将可用于 LLM 自动生成标签。
          </p>
          <p class="dialog-hint">
            当前使用次数: {{ convertDialog.count }}
          </p>
          <input
            v-model="convertDialog.description"
            type="text"
            placeholder="添加标签描述（可选）"
            class="dialog-input"
            @keypress.enter="executeConvert"
            ref="convertInput"
          />
          <div class="dialog-actions">
            <button @click="cancelConvert" class="cancel-btn">取消</button>
            <button @click="executeConvert" class="confirm-btn">
              确认转换
            </button>
          </div>
        </div>
      </div>

      <!-- 重命名系统标签对话框 -->
      <div v-if="renameSystemTagDialog.show" class="dialog-overlay" @click.self="cancelRenameSystemTag">
        <div class="dialog-box">
          <h3>✏️ 重命名系统标签</h3>
          <p class="dialog-hint">
            旧标签名: <strong>{{ renameSystemTagDialog.oldName }}</strong>
          </p>
          <input
            v-model="renameSystemTagDialog.newName"
            type="text"
            placeholder="输入新标签名"
            class="dialog-input"
            @keypress.enter="executeRenameSystemTag"
            ref="renameSystemTagInput"
          />
          <div class="dialog-actions">
            <button @click="cancelRenameSystemTag" class="cancel-btn">取消</button>
            <button
              @click="executeRenameSystemTag"
              :disabled="!renameSystemTagDialog.newName.trim()"
              class="confirm-btn"
            >
              确认重命名
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { success as showSuccess, error as showError, warning as showWarning } from '../composables/useToast'
import { API_BASE } from '@/utils/config'

const props = defineProps({
  show: Boolean
})

const emit = defineEmits(['close', 'tags-updated'])

// 当前选项卡
const currentTab = ref('system')

// 数据
const systemTags = ref([])
const userTags = ref([])
const loading = ref(false)
const searchQuery = ref('')
const sortBy = ref('count')

// 添加系统标签对话框
const addSystemTagDialog = ref({
  show: false,
  tagName: '',
  description: ''
})
const addSystemTagInput = ref(null)

// 转换对话框
const convertDialog = ref({
  show: false,
  tagName: '',
  count: 0,
  description: ''
})
const convertInput = ref(null)

// 重命名系统标签对话框
const renameSystemTagDialog = ref({
  show: false,
  oldName: '',
  newName: ''
})
const renameSystemTagInput = ref(null)

// 计算属性：当前显示的标签列表
const displayTags = computed(() => {
  let result = []

  if (currentTab.value === 'system') {
    // 系统标签（来自 system_tags 表）
    result = systemTags.value
  } else if (currentTab.value === 'user') {
    // 用户手动添加的标签（type 为 user_tag，即带 @ 前缀的标签）
    result = userTags.value.filter(tag => tag.type === 'user_tag')
  } else {
    // 文档标签
    result = userTags.value.filter(tag => tag.type === 'document_tag' || tag.document_count > 0)
  }

  // 搜索过滤
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(tag => {
      const name = tag.tag_name || tag.name
      return name.toLowerCase().includes(query)
    })
  }

  // 排序
  if (sortBy.value === 'count') {
    result = [...result].sort((a, b) => {
      const countA = a.usage_count || a.count || a.document_count || 0
      const countB = b.usage_count || b.count || b.document_count || 0
      return countB - countA
    })
  } else if (sortBy.value === 'name') {
    result = [...result].sort((a, b) => {
      const nameA = a.tag_name || a.name
      const nameB = b.tag_name || b.name
      return nameA.localeCompare(nameB, 'zh-CN')
    })
  }

  return result
})

// 监听显示状态
watch(() => props.show, (newVal) => {
  if (newVal) {
    loadAllTags()
  }
})

// 监听添加系统标签对话框
watch(() => addSystemTagDialog.value.show, async (newVal) => {
  if (newVal) {
    await nextTick()
    addSystemTagInput.value?.focus()
  }
})

// 监听转换对话框
watch(() => convertDialog.value.show, async (newVal) => {
  if (newVal) {
    await nextTick()
    convertInput.value?.focus()
  }
})

// 监听重命名系统标签对话框
watch(() => renameSystemTagDialog.value.show, async (newVal) => {
  if (newVal) {
    await nextTick()
    renameSystemTagInput.value?.focus()
  }
})

// 方法：加载所有标签
async function loadAllTags() {
  loading.value = true
  try {
    // 并行加载系统标签和用户标签
    const [systemResponse, userResponse] = await Promise.all([
      fetch(`${API_BASE}/system-tags`),
      fetch(`${API_BASE}/tags/all`)
    ])

    if (!systemResponse.ok) throw new Error(`加载系统标签失败: HTTP ${systemResponse.status}`)
    if (!userResponse.ok) throw new Error(`加载用户标签失败: HTTP ${userResponse.status}`)

    systemTags.value = await systemResponse.json()
    userTags.value = await userResponse.json()
  } catch (error) {
    console.error('加载标签失败:', error)
    showError(`加载标签失败: ${error.message}`)
  } finally {
    loading.value = false
  }
}

function getTypeLabel(type) {
  const labels = {
    'user_tag': '用户',
    'content_tag': '内容',
    'multiple': '混合',
    'document_tag': '文档'
  }
  return labels[type] || type
}

// 添加系统标签
function showAddSystemTagDialog() {
  addSystemTagDialog.value = {
    show: true,
    tagName: '',
    description: ''
  }
}

function cancelAddSystemTag() {
  addSystemTagDialog.value.show = false
}

async function executeAddSystemTag() {
  const tagName = addSystemTagDialog.value.tagName.trim()
  const description = addSystemTagDialog.value.description.trim()

  if (!tagName) {
    showWarning('请输入标签名称')
    return
  }

  try {
    const response = await fetch(`${API_BASE}/system-tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag_name: tagName, description: description || null })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || `HTTP ${response.status}`)
    }

    const result = await response.json()
    showSuccess(result.message || '系统标签创建成功')

    await loadAllTags()
    addSystemTagDialog.value.show = false
    emit('tags-updated')
  } catch (error) {
    console.error('创建系统标签失败:', error)
    showError(`创建系统标签失败: ${error.message}`)
  }
}

// 转换用户标签为系统标签
function showConvertDialog(tag) {
  convertDialog.value = {
    show: true,
    tagName: tag.name,
    count: tag.count || 0,
    description: ''
  }
}

function cancelConvert() {
  convertDialog.value.show = false
}

async function executeConvert() {
  const tagName = convertDialog.value.tagName
  const description = convertDialog.value.description.trim()

  if (!confirm(`确定要将用户标签 "${tagName}" 转换为系统标签吗？\n转换后该标签将可用于 LLM 自动生成标签。`)) {
    return
  }

  try {
    const response = await fetch(`${API_BASE}/system-tags/convert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag_name: tagName, description: description || null })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || `HTTP ${response.status}`)
    }

    const result = await response.json()
    showSuccess(result.message || '转换成功')

    await loadAllTags()
    convertDialog.value.show = false
    currentTab.value = 'system' // 切换到系统标签页
    emit('tags-updated')
  } catch (error) {
    console.error('转换标签失败:', error)
    showError(`转换标签失败: ${error.message}`)
  }
}

// 重命名系统标签
function startRenameSystemTag(tag) {
  renameSystemTagDialog.value = {
    show: true,
    oldName: tag.tag_name,
    newName: ''
  }
}

function cancelRenameSystemTag() {
  renameSystemTagDialog.value.show = false
}

async function executeRenameSystemTag() {
  const oldName = renameSystemTagDialog.value.oldName
  const newName = renameSystemTagDialog.value.newName.trim()

  if (!newName) {
    showWarning('请输入新标签名')
    return
  }

  if (oldName === newName) {
    showWarning('新旧标签名称相同')
    return
  }

  if (!confirm(`确定要将系统标签 "${oldName}" 重命名为 "${newName}" 吗？`)) {
    return
  }

  try {
    const response = await fetch(`${API_BASE}/system-tags/${encodeURIComponent(oldName)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag_name: newName })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || `HTTP ${response.status}`)
    }

    const result = await response.json()
    showSuccess(result.message || '重命名成功')

    await loadAllTags()
    renameSystemTagDialog.value.show = false
    emit('tags-updated')
  } catch (error) {
    console.error('重命名系统标签失败:', error)
    showError(`重命名系统标签失败: ${error.message}`)
  }
}

// 删除系统标签
async function confirmDeleteSystemTag(tag) {
  if (!confirm(`确定要删除系统标签 "${tag.tag_name}" 吗？\n该标签将不再可用于 LLM 自动生成标签。\n注意：这不会删除已有 chunk 中的标签。`)) {
    return
  }

  try {
    const response = await fetch(`${API_BASE}/system-tags/${encodeURIComponent(tag.tag_name)}`, {
      method: 'DELETE'
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || `HTTP ${response.status}`)
    }

    const result = await response.json()
    showSuccess(result.message || '删除成功')

    await loadAllTags()
    emit('tags-updated')
  } catch (error) {
    console.error('删除系统标签失败:', error)
    showError(`删除系统标签失败: ${error.message}`)
  }
}

// 删除用户标签或文档标签
async function confirmDelete(tag) {
  const tagName = tag.name
  const count = tag.count || tag.document_count || 0

  if (!confirm(`确定要删除标签 "${tagName}" 吗？\n这将从 ${count} 个切片/文档中删除该标签。\n此操作不可撤销！`)) {
    return
  }

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

    const result = await response.json()
    showSuccess(result.message || '删除成功')

    await loadAllTags()
    emit('tags-updated')
  } catch (error) {
    console.error('删除标签失败:', error)
    showError(`删除标签失败: ${error.message}`)
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
  max-width: 900px;
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

.tab-switcher {
  display: flex;
  border-bottom: 1px solid #e1e8ed;
  background: #f8f9fa;
}

.tab-btn {
  flex: 1;
  padding: 12px 16px;
  background: none;
  border: none;
  border-bottom: 3px solid transparent;
  font-size: 14px;
  font-weight: 600;
  color: #7f8c8d;
  cursor: pointer;
  transition: all 0.3s;
}

.tab-btn:hover {
  background: #ecf0f1;
  color: #2c3e50;
}

.tab-btn.active {
  color: #3498db;
  border-bottom-color: #3498db;
  background: white;
}

.tab-description {
  padding: 12px 24px;
  background: #e3f2fd;
  border-bottom: 1px solid #bbdefb;
}

.tab-description p {
  margin: 0;
  font-size: 13px;
  color: #1565c0;
  line-height: 1.6;
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
  padding: 14px 16px;
  border: 1px solid #e1e8ed;
  border-radius: 8px;
  margin-bottom: 8px;
  transition: all 0.2s;
  background: white;
}

.tag-item:hover {
  background: #f8f9fa;
  border-color: #3498db;
  transform: translateX(4px);
}

.tag-info {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.tag-name {
  font-size: 15px;
  font-weight: 600;
  color: #2c3e50;
}

.tag-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.system-badge {
  background: #d4edff;
  color: #0d47a1;
}

.user-badge {
  background: #fff3cd;
  color: #856404;
}

.doc-badge {
  background: #d4f4dd;
  color: #1b5e20;
}

.tag-count {
  font-size: 13px;
  color: #7f8c8d;
}

.tag-description {
  font-size: 12px;
  color: #95a5a6;
  font-style: italic;
  flex-basis: 100%;
  margin-top: -4px;
}

.tag-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  background: white;
  border: 1px solid #ddd;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition: all 0.2s;
  white-space: nowrap;
}

.action-btn:hover {
  transform: scale(1.05);
}

.convert-btn {
  background: #9b59b6;
  color: white;
  border-color: #8e44ad;
}

.convert-btn:hover {
  background: #8e44ad;
  box-shadow: 0 2px 8px rgba(155, 89, 182, 0.3);
}

.rename-btn:hover {
  background: #fff3cd;
  border-color: #ffc107;
}

.delete-btn:hover {
  background: #ffebee;
  border-color: #e74c3c;
  color: #e74c3c;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #95a5a6;
}

.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 4000;
}

.dialog-box {
  background: white;
  padding: 28px;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
  width: 90%;
  max-width: 450px;
}

.dialog-box h3 {
  margin: 0 0 16px 0;
  font-size: 18px;
  color: #2c3e50;
}

.dialog-hint {
  font-size: 14px;
  color: #7f8c8d;
  margin: 8px 0;
  line-height: 1.5;
}

.dialog-hint strong {
  color: #2c3e50;
  font-weight: 600;
}

.dialog-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  margin: 12px 0;
  box-sizing: border-box;
}

.dialog-input:focus {
  outline: none;
  border-color: #3498db;
  box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1);
}

.dialog-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 20px;
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
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(52, 152, 219, 0.3);
}

.confirm-btn:disabled {
  background: #bdc3c7;
  cursor: not-allowed;
  opacity: 0.6;
}
</style>
