<template>
  <div v-if="visible" class="modal-overlay" @click="handleOverlayClick">
    <div class="modal-container" @click.stop>
      <!-- 头部 -->
      <div class="modal-header">
        <div class="header-info">
          <h2>Chunk #{{ chunk?.metadata?.chunk_id || '?' }}</h2>
          <div class="header-badges">
            <span class="badge badge-file">{{ chunk?.source_file || chunk?.metadata?.source_file || '未知文件' }}</span>
            <span v-if="chunk?.metadata?.user_tag" class="badge badge-tag">{{ chunk.metadata.user_tag }}</span>
            <span v-if="chunk?.metadata?.is_atomic" class="badge badge-atomic">ATOMIC</span>
          </div>
        </div>
        <button class="close-btn" @click="handleClose" title="关闭 (ESC)">✕</button>
      </div>

      <!-- 元数据信息 -->
      <div class="metadata-section">
        <div class="metadata-item">
          <span class="label">相似度分数:</span>
          <span class="value score" :class="similarityClass" :title="`L2距离: ${(chunk?.score || 0).toFixed(4)}`">
            {{ similarityScore }}
          </span>
        </div>
        <div class="metadata-item">
          <span class="label">Token 数:</span>
          <span class="value">{{ chunk?.metadata?.token_count || 0 }}</span>
        </div>
        <div v-if="contentTags.length > 0" class="metadata-item full-width">
          <span class="label">内容标签:</span>
          <div class="tags">
            <span v-for="tag in contentTags" :key="tag" class="tag">{{ tag }}</span>
          </div>
        </div>
      </div>

      <!-- 内容区域 -->
      <div class="content-section">
        <div class="content-header">
          <h3>内容</h3>
          <div class="header-actions">
            <button @click="copyContent" class="copy-btn" title="复制内容">
              {{ copied ? '✓ 已复制' : '📋 复制' }}
            </button>
          </div>
        </div>
        <div class="content-body">
          <div v-if="renderedContent" class="rendered-content" v-html="renderedContent"></div>
          <div v-else class="empty-content">无内容</div>
        </div>
      </div>

      <!-- 快捷跳转区域 -->
      <div class="quick-nav-section">
        <button @click="jumpToDocument" class="jump-btn jump-document" title="在文档视图中查看">
          📄 跳转到文档
        </button>
        <button @click="jumpToChunk" class="jump-btn jump-chunk" title="在编辑器中查看并编辑">
          ✏️ 跳转到切片编辑
        </button>
      </div>

      <!-- 底部导航 -->
      <div class="modal-footer">
        <button
          v-if="hasPrev"
          @click="$emit('prev')"
          class="nav-btn nav-prev"
          title="上一个 (←)"
        >
          ← 上一个
        </button>
        <span class="nav-info">{{ currentIndex + 1 }} / {{ total }}</span>
        <button
          v-if="hasNext"
          @click="$emit('next')"
          class="nav-btn nav-next"
          title="下一个 (→)"
        >
          下一个 →
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { marked } from 'marked'
import { computed, ref, watch } from 'vue'

// 配置marked，与 ChunkEditor 保持一致
marked.setOptions({
  breaks: true,
  gfm: true,
  tables: true,
  headerIds: false,
  mangle: false,
  sanitize: false
})

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  chunk: {
    type: Object,
    default: null
  },
  currentIndex: {
    type: Number,
    default: 0
  },
  total: {
    type: Number,
    default: 0
  }
})

const emit = defineEmits(['close', 'prev', 'next', 'jump-to-document', 'jump-to-chunk'])

const copied = ref(false)

// 计算属性
const renderedContent = computed(() => {
  if (!props.chunk?.content) return ''
  
  try {
    // 优先使用 edited_content，如果不存在则使用原始 content
    const contentToRender = props.chunk.edited_content || props.chunk.content
    return marked.parse(contentToRender)
  } catch (error) {
    console.error('Markdown渲染失败:', error)
    return props.chunk.edited_content || props.chunk.content
  }
})

const contentTags = computed(() => {
  if (!props.chunk?.metadata?.content_tags) return []

  try {
    const tags = typeof props.chunk.metadata.content_tags === 'string'
      ? JSON.parse(props.chunk.metadata.content_tags)
      : props.chunk.metadata.content_tags

    return Array.isArray(tags) ? tags.filter(t => t && t !== 'none') : []
  } catch {
    return []
  }
})

const hasPrev = computed(() => props.currentIndex > 0)
const hasNext = computed(() => props.currentIndex < props.total - 1)

// 计算相似度（使用 Milvus 官方的 L2 归一化公式）
// 对于 L2 距离: normalized_score = 1.0 - (2 × arctan(score)) / π
// 参考: https://milvus.io/docs/metric.md
const similarityScore = computed(() => {
  const score = props.chunk?.score
  if (!score && score !== 0) return '-'

  // Milvus L2 距离的归一化公式
  const similarity = 1.0 - (2 * Math.atan(score)) / Math.PI

  // 限制在 0-1 范围内
  const bounded = Math.max(0, Math.min(1, similarity))
  return bounded.toFixed(3)
})

// 根据相似度返回 CSS 类（用于颜色）
const similarityClass = computed(() => {
  const score = props.chunk?.score
  if (!score && score !== 0) return 'similarity-unknown'

  // 使用归一化后的相似度计算百分比
  const similarity = (1.0 - (2 * Math.atan(score)) / Math.PI) * 100

  if (similarity >= 80) return 'similarity-excellent'  // 绿色
  if (similarity >= 60) return 'similarity-good'       // 浅绿
  if (similarity >= 40) return 'similarity-fair'       // 黄色
  if (similarity >= 20) return 'similarity-poor'       // 橙色
  return 'similarity-bad'                               // 红色
})

// 方法
function handleClose() {
  emit('close')
}

function handleOverlayClick() {
  handleClose()
}

function copyContent() {
  if (!props.chunk?.content) return

  navigator.clipboard.writeText(props.chunk.content).then(() => {
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  })
}

function jumpToDocument() {
  const sourceFile = props.chunk?.source_file || props.chunk?.metadata?.source_file
  if (sourceFile) {
    emit('jump-to-document', {
      source_file: sourceFile,
      chunk_id: props.chunk?.metadata?.chunk_id
    })
  }
}

function jumpToChunk() {
  emit('jump-to-chunk', {
    chunk_id: props.chunk?.metadata?.chunk_id,
    db_id: props.chunk?.metadata?.chunk_db_id || props.chunk?.chunk_id,
    source_file: props.chunk?.source_file || props.chunk?.metadata?.source_file,
    document_id: props.chunk?.metadata?.document_id
  })
}

// 键盘导航
function handleKeydown(e) {
  if (!props.visible) return

  switch (e.key) {
    case 'Escape':
      handleClose()
      break
    case 'ArrowLeft':
      if (hasPrev.value) emit('prev')
      break
    case 'ArrowRight':
      if (hasNext.value) emit('next')
      break
  }
}

// 监听键盘事件
watch(() => props.visible, (newVal) => {
  if (newVal) {
    document.addEventListener('keydown', handleKeydown)
    document.body.style.overflow = 'hidden'
  } else {
    document.removeEventListener('keydown', handleKeydown)
    document.body.style.overflow = ''
    copied.value = false
  }
})
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
  padding: 20px;
  backdrop-filter: blur(4px);
}

.modal-container {
  background: #ffffff;
  border-radius: 12px;
  width: 100%;
  max-width: 1000px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  border: 1px solid #e0e0e0;
}

/* 头部 */
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 24px 28px;
  border-bottom: 2px solid #e0e0e0;
  background: linear-gradient(to bottom, #f8f9fa, #ffffff);
}

.header-info {
  flex: 1;
}

.header-info h2 {
  margin: 0 0 12px 0;
  color: #2196F3;
  font-size: 24px;
  font-weight: 600;
}

.header-badges {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.badge {
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.badge-file {
  background: #e8f5e9;
  color: #2e7d32;
  font-family: 'Consolas', 'Monaco', monospace;
  border: 1px solid #81c784;
}

.badge-tag {
  background: #e3f2fd;
  color: #1976d2;
  border: 1px solid #90caf9;
}

.badge-atomic {
  background: #ffebee;
  color: #c62828;
  border: 1px solid #ef5350;
}

.close-btn {
  background: transparent;
  border: none;
  color: #666;
  font-size: 28px;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s;
  flex-shrink: 0;
}

.close-btn:hover {
  background: #f0f0f0;
  color: #333;
}

/* 元数据区域 */
.metadata-section {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  padding: 20px 28px;
  background: #f8f9fa;
  border-bottom: 1px solid #e0e0e0;
}

.metadata-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.metadata-item.full-width {
  width: 100%;
  flex-direction: column;
  align-items: flex-start;
}

.metadata-item .label {
  color: #666;
  font-size: 13px;
  font-weight: 500;
}

.metadata-item .value {
  color: #333;
  font-weight: 600;
}

.metadata-item .value.score {
  font-weight: 700;
  font-size: 16px;
  padding: 4px 10px;
  border-radius: 6px;
  display: inline-block;
}

/* 相似度分数颜色 - 与 SemanticSearch 保持一致 */
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

.tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.tag {
  background: #e3f2fd;
  color: #1976d2;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  border: 1px solid #90caf9;
  font-weight: 500;
}

/* 内容区域 */
.content-section {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 20px 28px;
  background: #ffffff;
}

.content-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.content-header h3 {
  margin: 0;
  color: #333;
  font-size: 16px;
  font-weight: 600;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.copy-btn {
  background: #f0f0f0;
  border: 1px solid #ddd;
  color: #666;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
  font-weight: 500;
}

.copy-btn:hover {
  background: #e0e0e0;
  color: #333;
  border-color: #bbb;
}

.content-body {
  flex: 1;
  overflow-y: auto;
  background: #f9f9f9;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 16px;
}

.rendered-content {
  color: #333;
  font-size: 14px;
  line-height: 1.6;
}

.empty-content {
  color: #666;
  font-style: italic;
  text-align: center;
  padding: 40px;
}

/* Markdown 渲染样式 - 与 ChunkEditor 保持一致 */
.rendered-content :deep(h1) {
  font-size: 2em;
  font-weight: bold;
  margin-top: 0.5em;
  margin-bottom: 0.5em;
  color: #2c3e50;
}

.rendered-content :deep(h2) {
  font-size: 1.5em;
  font-weight: bold;
  margin-top: 0.5em;
  margin-bottom: 0.5em;
  color: #2c3e50;
}

.rendered-content :deep(h3) {
  font-size: 1.2em;
  font-weight: bold;
  margin-top: 0.5em;
  margin-bottom: 0.5em;
  color: #2c3e50;
}

.rendered-content :deep(p) {
  margin: 0.5em 0;
}

.rendered-content :deep(ul),
.rendered-content :deep(ol) {
  padding-left: 1.5em;
  margin: 0.5em 0;
}

.rendered-content :deep(code) {
  background: #f5f5f5;
  color: #d63384;
  padding: 0.2em 0.4em;
  border-radius: 3px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 0.9em;
  border: 1px solid #e0e0e0;
}

.rendered-content :deep(pre) {
  background: #f5f5f5;
  color: #333;
  padding: 1em;
  border-radius: 8px;
  overflow-x: auto;
  font-family: 'Consolas', 'Monaco', monospace;
  margin: 1em 0;
  border: 1px solid #e0e0e0;
}

.rendered-content :deep(pre code) {
  background: none;
  padding: 0;
  color: inherit;
  border: none;
}

/* 表格样式 - 与 ChunkEditor 保持一致 */
.rendered-content :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 1em 0;
  overflow: hidden;
  background: #ffffff;
  border: 1px solid #dee2e6;
}

.rendered-content :deep(table td),
.rendered-content :deep(table th) {
  border: 1px solid #dee2e6;
  padding: 8px 12px;
  vertical-align: top;
  box-sizing: border-box;
  position: relative;
  min-width: 1em;
  color: #333;
}

.rendered-content :deep(table th) {
  background-color: #f8f9fa;
  font-weight: bold;
  text-align: left;
  color: #2c3e50;
}

.rendered-content :deep(table tr:hover) {
  background-color: rgba(0, 0, 0, 0.02);
}

.rendered-content :deep(table p) {
  margin: 0;
}

/* 图片样式 - 与 ChunkEditor 保持一致 */
.rendered-content :deep(img) {
  max-width: 100%;
  max-height: 200px;
  height: auto;
  display: block;
  margin: 1em auto;
  border-radius: 4px;
  cursor: pointer;
  object-fit: contain;
  background: #f5f5f5;
  border: 1px solid #e0e0e0;
}

.rendered-content :deep(img:hover) {
  opacity: 0.9;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

/* 引用样式 */
.rendered-content :deep(blockquote) {
  border-left: 4px solid #2196F3;
  padding-left: 1em;
  margin: 1em 0;
  color: #666;
  font-style: italic;
  background: #f5f5f5;
  padding: 0.5em 1em;
  border-radius: 4px;
}

/* 链接样式 */
.rendered-content :deep(a) {
  color: #2196F3;
  text-decoration: none;
}

.rendered-content :deep(a:hover) {
  text-decoration: underline;
  color: #1976D2;
}

/* 分隔线 */
.rendered-content :deep(hr) {
  border: none;
  border-top: 2px solid #e0e0e0;
  margin: 1.5em 0;
}

/* 快捷跳转区域 */
.quick-nav-section {
  display: flex;
  gap: 12px;
  padding: 16px 28px;
  background: #f8f9fa;
  border-top: 1px solid #e0e0e0;
}

.jump-btn {
  flex: 1;
  padding: 10px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.jump-document {
  background: #1565c0;
  color: #fff;
}

.jump-document:hover {
  background: #1976d2;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(21, 101, 192, 0.3);
}

.jump-chunk {
  background: #2e7d32;
  color: #fff;
}

.jump-chunk:hover {
  background: #388e3c;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(46, 125, 50, 0.3);
}

.jump-btn:active {
  transform: translateY(0);
}

/* 底部导航 */
.modal-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 28px;
  border-top: 1px solid #e0e0e0;
  background: #f8f9fa;
}

.nav-info {
  color: #666;
  font-size: 14px;
  font-weight: 500;
}

.nav-btn {
  background: #2196F3;
  border: none;
  color: white;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
  font-weight: 500;
}

.nav-btn:hover {
  background: #1976D2;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(33, 150, 243, 0.3);
}

.nav-btn:active {
  transform: translateY(0);
}

.nav-prev {
  margin-right: auto;
}

.nav-next {
  margin-left: auto;
}

/* 滚动条样式 */
.content-body::-webkit-scrollbar {
  width: 10px;
}

.content-body::-webkit-scrollbar-track {
  background: #f5f5f5;
  border-radius: 6px;
}

.content-body::-webkit-scrollbar-thumb {
  background: #ccc;
  border-radius: 6px;
}

.content-body::-webkit-scrollbar-thumb:hover {
  background: #999;
}
</style>
