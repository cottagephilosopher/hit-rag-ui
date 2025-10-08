<template>
  <div class="version-history-panel">
    <header class="history-header">
      <h3>📜 版本历史</h3>
      <button @click="$emit('close')" class="btn-close-history">✕</button>
    </header>

    <div class="history-body">
      <!-- 加载状态 -->
      <div v-if="loading" class="history-placeholder">
        <div class="loading-spinner">⏳</div>
        <p>加载中...</p>
      </div>

      <!-- 空状态 -->
      <div v-else-if="!logs.length" class="history-placeholder">
        <p>📭 暂无版本记录</p>
      </div>

      <!-- 日志列表 -->
      <ul v-else class="log-list">
        <li v-for="log in logs" :key="log.id" class="log-entry">
          <!-- 日志元信息 -->
          <div class="log-meta">
            <span class="log-time">{{ formatTime(log.created_at) }}</span>
            <span class="log-user">{{ log.user_id || '系统' }}</span>
            <span class="log-action" :class="`action-${log.action}`">
              {{ getActionLabel(log.action) }}
            </span>
          </div>

          <!-- 操作描述 -->
          <p class="log-message">{{ log.message || log.action }}</p>

          <!-- 变更详情 -->
          <div v-if="getChanges(log)" class="log-changes">
            <div
              v-for="(change, key) in getChanges(log)"
              :key="key"
              class="log-change"
            >
              <strong class="change-field">{{ getFieldLabel(key) }}</strong>

              <!-- 状态变更 -->
              <div v-if="key === 'status'" class="change-status">
                <span class="status-badge" :class="`status-${change.before}`">
                  {{ change.before_name || getStatusName(change.before) }}
                </span>
                <span class="arrow">→</span>
                <span class="status-badge" :class="`status-${change.after}`">
                  {{ change.after_name || getStatusName(change.after) }}
                </span>
              </div>

              <!-- 文本差异 -->
              <div v-else-if="typeof change.before === 'string'" class="change-diff">
                <div class="change-before">
                  <span class="label">旧</span>
                  <pre v-html="highlightDiff(change.before, change.after).before"></pre>
                </div>
                <div class="change-after">
                  <span class="label">新</span>
                  <pre v-html="highlightDiff(change.before, change.after).after"></pre>
                </div>
              </div>

              <!-- 数组差异（如标签） -->
              <div v-else-if="Array.isArray(change.before)" class="change-array">
                <div class="change-before">
                  <span class="label">旧</span>
                  <div class="tag-list">
                    <span v-for="tag in change.before" :key="tag" class="tag">{{ tag }}</span>
                  </div>
                </div>
                <div class="change-after">
                  <span class="label">新</span>
                  <div class="tag-list">
                    <span v-for="tag in change.after" :key="tag" class="tag">{{ tag }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { highlightDiff } from '../utils/diffHighlight'

const props = defineProps({
  chunkId: {
    type: Number,
    required: true
  }
})

defineEmits(['close'])

const logs = ref([])
const loading = ref(false)

// 获取日志数据
async function fetchLogs() {
  loading.value = true
  try {
    const response = await fetch(`http://localhost:8000/api/chunks/${props.chunkId}/logs?limit=50`)
    if (!response.ok) throw new Error('Failed to fetch logs')

    logs.value = await response.json()
  } catch (error) {
    console.error('Failed to fetch logs:', error)
    logs.value = []
  } finally {
    loading.value = false
  }
}

// 获取变更信息
function getChanges(log) {
  const payload = log?.payload
  if (!payload || typeof payload !== 'object') return null

  const changes = payload.changes
  if (!changes || typeof changes !== 'object') return null

  return changes
}

// 格式化时间
function formatTime(timestamp) {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now - date

  // 1小时内显示"X分钟前"
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000)
    return minutes < 1 ? '刚刚' : `${minutes}分钟前`
  }

  // 24小时内显示"X小时前"
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000)
    return `${hours}小时前`
  }

  // 否则显示完整时间
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 操作类型标签
function getActionLabel(action) {
  const labels = {
    create: '创建',
    update: '更新',
    status_change: '状态变更',
    delete: '删除',
    rollback: '回滚'
  }
  return labels[action] || action
}

// 字段标签
function getFieldLabel(field) {
  const labels = {
    edited_content: '内容',
    status: '状态',
    content_tags: '内容标签',
    user_tag: '用户标签'
  }
  return labels[field] || field
}

// 状态名称
function getStatusName(status) {
  const names = {
    '-1': '已废弃',
    '0': '初始',
    '1': '已确认',
    '2': '已向量化'
  }
  return names[String(status)] || '未知'
}

// 截断文本
function truncate(text, maxLength) {
  if (!text) return ''
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

onMounted(() => {
  fetchLogs()
})
</script>

<style scoped>
.version-history-panel {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 400px;
  background: white;
  border-left: 2px solid #e0e0e0;
  display: flex;
  flex-direction: column;
  box-shadow: -4px 0 12px rgba(0, 0, 0, 0.1);
  z-index: 10;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #f5f5f5;
  border-bottom: 1px solid #e0e0e0;
}

.history-header h3 {
  margin: 0;
  font-size: 16px;
  color: #333;
}

.btn-close-history {
  padding: 4px 8px;
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 18px;
  color: #666;
  transition: color 0.2s;
}

.btn-close-history:hover {
  color: #333;
}

.history-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.history-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: #999;
  text-align: center;
}

.loading-spinner {
  font-size: 32px;
  animation: spin 2s linear infinite;
  margin-bottom: 12px;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.log-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.log-entry {
  padding: 12px;
  background: #fafafa;
  border-radius: 6px;
  margin-bottom: 12px;
  border-left: 3px solid #3498db;
}

.log-entry:hover {
  background: #f5f5f5;
}

.log-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.log-time {
  font-size: 11px;
  color: #999;
}

.log-user {
  font-size: 11px;
  color: #666;
  background: #e0e0e0;
  padding: 2px 6px;
  border-radius: 3px;
}

.log-action {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 3px;
  font-weight: 500;
}

.action-create {
  background: #e3f2fd;
  color: #1976d2;
}

.action-update {
  background: #fff3e0;
  color: #f57c00;
}

.action-status_change {
  background: #f3e5f5;
  color: #7b1fa2;
}

.action-delete {
  background: #ffebee;
  color: #c62828;
}

.log-message {
  font-size: 13px;
  color: #333;
  margin: 0 0 8px 0;
}

.log-changes {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #e0e0e0;
}

.log-change {
  margin-bottom: 12px;
}

.change-field {
  display: block;
  font-size: 11px;
  color: #666;
  margin-bottom: 4px;
  text-transform: uppercase;
}

.change-status {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-badge {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.status--1 {
  background: #ffebee;
  color: #c62828;
}

.status-0 {
  background: #f5f5f5;
  color: #666;
}

.status-1 {
  background: #e8f5e9;
  color: #2e7d32;
}

.status-2 {
  background: #e3f2fd;
  color: #1976d2;
}

.arrow {
  color: #999;
  font-size: 14px;
}

.change-diff,
.change-array {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.change-before,
.change-after {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 8px;
  position: relative;
}

.change-before .label,
.change-after .label {
  position: absolute;
  top: 4px;
  right: 4px;
  font-size: 9px;
  padding: 2px 4px;
  border-radius: 2px;
  background: #999;
  color: white;
  text-transform: uppercase;
}

.change-before pre,
.change-after pre {
  margin: 0;
  font-size: 11px;
  white-space: pre-wrap;
  word-break: break-word;
  color: #333;
  font-family: monospace;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.tag {
  display: inline-block;
  padding: 2px 6px;
  background: #e3f2fd;
  color: #1976d2;
  border-radius: 3px;
  font-size: 11px;
}

/* Diff 高亮样式 */
.log-changes :deep(.diff-line) {
  display: block;
  margin: 2px 0;
  padding: 2px 4px;
  border-radius: 4px;
}

.log-changes :deep(.diff-line-placeholder) {
  opacity: 0.25;
  background: transparent;
}

.log-changes :deep(.diff-line-add) {
  background: rgba(34, 197, 94, 0.2);
  color: #166534;
}

.log-changes :deep(.diff-line-remove) {
  background: rgba(239, 68, 68, 0.2);
  color: #991b1b;
}

.log-changes :deep(.diff-mark) {
  border-radius: 3px;
  padding: 0 2px;
}

.log-changes :deep(.diff-mark.diff-remove) {
  text-decoration: line-through;
  background: rgba(239, 68, 68, 0.4);
  color: #991b1b;
}

.log-changes :deep(.diff-mark.diff-add) {
  font-weight: 600;
  background: rgba(34, 197, 94, 0.4);
  color: #166534;
}
</style>
