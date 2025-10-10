<template>
  <div class="chunk-editor-fullscreen">
    <!-- 版本历史面板 -->
    <ChunkVersionHistory
      v-if="showHistory"
      :chunk-id="chunk.id"
      @close="showHistory = false"
    />

    <div class="editor-header">
      <div class="editor-title">
        <h3>
          ✏️ 编辑 Chunk #{{ chunk.chunk_id }}
          <span v-if="chunk.is_atomic" class="atomic-badge" :title="`ATOMIC ${chunk.atomic_type} 块`">
            ⚛️ {{ chunk.atomic_type?.toUpperCase() }}
          </span>
        </h3>
        <div class="chunk-meta">
          <span class="meta-item">Token: {{ chunk.token_start }} → {{ chunk.token_end }}</span>
          <span class="meta-separator">|</span>
          <span class="meta-item">共 {{ chunk.token_count }} tokens</span>
          <template v-if="chunk.is_atomic">
            <span class="meta-separator">|</span>
            <span class="meta-item atomic-meta">ATOMIC 块（完整保留）</span>
          </template>
        </div>
      </div>
      <div class="editor-actions">
        <button @click="showHistory = !showHistory" class="btn-history">
          📜 {{ showHistory ? '隐藏' : '历史' }}
        </button>
        <button
          v-if="chunk.status !== -1 && chunk.status !== 2"
          @click="vectorizeChunk"
          class="btn-vectorize"
          :disabled="vectorizing"
        >
          {{ vectorizing ? '向量化中...' : '📤 向量化' }}
        </button>
        <button
          v-if="chunk.status === 2"
          @click="deleteFromVector"
          class="btn-delete-vector"
          :disabled="deleting"
        >
          {{ deleting ? '删除中...' : '🗑️ 从向量库删除' }}
        </button>
        <span v-if="chunk.status === 2" class="vectorized-status">✅ 已向量化</span>
        <button @click="markAsDeprecated" class="btn-deprecate" :disabled="chunk.status === -1">
          🗑️ {{ chunk.status === -1 ? '已废弃' : '废弃' }}
        </button>
        <button @click="saveAndClose" class="btn-save">💾 保存</button>
        <button @click="close" class="btn-close">✕ 关闭</button>
      </div>
    </div>

    <!-- 标签管理区域 -->
    <div class="tags-section">
      <div class="tags-row">
        <label>标签管理:</label>
        <div class="tags-container">
          <!-- AI 生成的标签（content_tags，可删除，带圆点） -->
          <span
            v-for="(tag, index) in aiGeneratedTags"
            :key="'ai-' + index"
            class="tag ai-tag"
            :title="'AI 生成的标签（可删除）'"
          >
            <span class="ai-dot">●</span> {{ tag }}
            <button @click="removeAiTag(index)" class="tag-remove">×</button>
          </span>

          <!-- 人工添加的标签（user_tag 和手动添加的，可删除） -->
          <span
            v-if="userTagInput.trim()"
            class="tag manual-tag"
            :title="'人工添加的标签'"
          >
            {{ userTagInput }}
            <button @click="clearUserTag" class="tag-remove">×</button>
          </span>
          <span
            v-for="(tag, index) in manualTags"
            :key="'manual-' + index"
            class="tag manual-tag"
            :title="'人工添加的标签'"
          >
            {{ tag }}
            <button @click="removeManualTag(index)" class="tag-remove">×</button>
          </span>

          <!-- 输入框 -->
          <input
            v-model="newTag"
            @keydown.enter.prevent="addManualTag"
            type="text"
            placeholder="输入标签后按回车添加"
            class="tag-input-inline"
          />
        </div>
        <div class="tag-legend">
          <span class="legend-item"><span class="ai-dot">●</span> AI生成（可删除）</span>
          <span class="legend-item">无圆点为人工添加</span>
        </div>
      </div>
    </div>

    <div class="editor-toolbar" v-if="editor">
      <button
        @click="editor.chain().focus().toggleBold().run()"
        :class="{ 'is-active': editor.isActive('bold') }"
        class="toolbar-btn"
      >
        <strong>B</strong>
      </button>
      <button
        @click="editor.chain().focus().toggleItalic().run()"
        :class="{ 'is-active': editor.isActive('italic') }"
        class="toolbar-btn"
      >
        <em>I</em>
      </button>
      <button
        @click="editor.chain().focus().toggleStrike().run()"
        :class="{ 'is-active': editor.isActive('strike') }"
        class="toolbar-btn"
      >
        <s>S</s>
      </button>
      <div class="toolbar-divider"></div>
      <button
        @click="editor.chain().focus().toggleHeading({ level: 1 }).run()"
        :class="{ 'is-active': editor.isActive('heading', { level: 1 }) }"
        class="toolbar-btn"
      >
        H1
      </button>
      <button
        @click="editor.chain().focus().toggleHeading({ level: 2 }).run()"
        :class="{ 'is-active': editor.isActive('heading', { level: 2 }) }"
        class="toolbar-btn"
      >
        H2
      </button>
      <button
        @click="editor.chain().focus().toggleHeading({ level: 3 }).run()"
        :class="{ 'is-active': editor.isActive('heading', { level: 3 }) }"
        class="toolbar-btn"
      >
        H3
      </button>
      <div class="toolbar-divider"></div>
      <button
        @click="editor.chain().focus().toggleBulletList().run()"
        :class="{ 'is-active': editor.isActive('bulletList') }"
        class="toolbar-btn"
      >
        ●
      </button>
      <button
        @click="editor.chain().focus().toggleOrderedList().run()"
        :class="{ 'is-active': editor.isActive('orderedList') }"
        class="toolbar-btn"
      >
        1.
      </button>
      <button
        @click="editor.chain().focus().toggleCodeBlock().run()"
        :class="{ 'is-active': editor.isActive('codeBlock') }"
        class="toolbar-btn"
      >
        &lt;/&gt;
      </button>
      <div class="toolbar-divider"></div>
      <button
        @click="addImage"
        class="toolbar-btn"
        title="插入图片"
      >
        🖼️
      </button>
      <div class="toolbar-divider"></div>
      <button
        @click="editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()"
        class="toolbar-btn"
        title="插入表格"
      >
        ⊞
      </button>
      <button
        @click="editor.chain().focus().addColumnAfter().run()"
        :disabled="!editor.isActive('table')"
        class="toolbar-btn"
        title="添加列"
      >
        ⊕→
      </button>
      <button
        @click="editor.chain().focus().addRowAfter().run()"
        :disabled="!editor.isActive('table')"
        class="toolbar-btn"
        title="添加行"
      >
        ⊕↓
      </button>
      <button
        @click="editor.chain().focus().deleteTable().run()"
        :disabled="!editor.isActive('table')"
        class="toolbar-btn"
        title="删除表格"
      >
        ⊗
      </button>
      <div class="toolbar-divider"></div>
      <button
        @click="editor.chain().focus().undo().run()"
        :disabled="!editor.can().undo()"
        class="toolbar-btn"
      >
        ↶
      </button>
      <button
        @click="editor.chain().focus().redo().run()"
        :disabled="!editor.can().redo()"
        class="toolbar-btn"
      >
        ↷
      </button>
    </div>

    <div class="editor-container">
      <editor-content :editor="editor" class="editor-content" />
    </div>

    <div class="editor-footer">
      <button
        @click="navigatePrev"
        :disabled="currentIndex === 0"
        class="nav-btn"
        title="上一条"
      >
        ← 上一条
      </button>

      <div class="footer-info">
        <span v-if="hasChanges" class="unsaved-indicator">● 未保存的更改</span>
        <span v-else class="saved-indicator">✓ 已保存</span>
        <span class="chunk-position">
          {{ currentIndex + 1 }} / {{ totalChunks }}
        </span>
      </div>

      <button
        @click="navigateNext"
        :disabled="currentIndex >= totalChunks - 1"
        class="nav-btn"
        title="下一条"
      >
        下一条 →
      </button>
    </div>
  </div>
</template>

<script setup>
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import Table from '@tiptap/extension-table'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import TableRow from '@tiptap/extension-table-row'
import ChunkVersionHistory from './ChunkVersionHistory.vue'
import StarterKit from '@tiptap/starter-kit'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import { API_BASE } from '@/utils/config'
import { Markdown } from 'tiptap-markdown'
import { marked } from 'marked'
import { computed, onBeforeUnmount, onMounted, ref, watch, nextTick } from 'vue'
import { useLazyImage } from '../composables/useLazyImage'
import { CONFIG } from '../utils/config'

// 配置marked
marked.setOptions({
  breaks: true,
  gfm: true,
  tables: true,
  headerIds: false,
  mangle: false,
  sanitize: false
})

const props = defineProps({
  chunk: {
    type: Object,
    required: true
  },
  totalChunks: {
    type: Number,
    default: 0
  },
  currentDocument: {
    type: String,
    default: null
  },
  currentIndex: {
    type: Number,
    default: 0
  }
})

const emit = defineEmits(['close', 'save', 'navigate'])

const hasChanges = ref(false)
const originalContent = ref('')
const showHistory = ref(false)
const vectorizing = ref(false)
const deleting = ref(false)

// 标签相关状态
const aiGeneratedTags = ref([])     // AI 生成的标签（content_tags，只读）
const userTagInput = ref('')        // 第一个人工标签（user_tag）
const manualTags = ref([])          // 其他人工添加的标签
const newTag = ref('')              // 新标签输入

// 延迟加载图片
const { setupLazyLoadForImages } = useLazyImage()

// 将markdown内容渲染成HTML
const renderedContent = computed(() => {
  try {
    // 优先使用 edited_content，如果不存在则使用原始 content
    const contentToRender = props.chunk.edited_content || props.chunk.content || ''
    return marked.parse(contentToRender)
  } catch (error) {
    console.error('Markdown渲染失败:', error)
    return props.chunk.edited_content || props.chunk.content || ''
  }
})

const editor = useEditor({
  extensions: [
    StarterKit,
    Markdown.configure({
      html: true,  // 允许在 markdown 中使用 HTML（用于表格）
      tightLists: true,
      bulletListMarker: '-',
      linkify: true,
      breaks: true,
    }),
    Placeholder.configure({
      placeholder: '开始编辑内容...',
    }),
    Table.configure({
      resizable: true,
      HTMLAttributes: {
        class: 'editor-table',
      },
    }),
    TableRow,
    TableHeader,
    TableCell,
    Image.configure({
      inline: true,
      allowBase64: true,
      HTMLAttributes: {
        class: 'editor-image',
      },
    }),
  ],
  // 使用渲染后的HTML内容
  content: renderedContent.value,
  editorProps: {
    attributes: {
      class: 'prose prose-sm max-w-none focus:outline-none',
    },
  },
  onUpdate: () => {
    hasChanges.value = editor.value?.getHTML() !== originalContent.value
    // 设置延迟加载
    setupEditorLazyLoad()
  },
})

// 设置编辑器中的图片延迟加载
async function setupEditorLazyLoad() {
  await nextTick()
  const editorElement = document.querySelector('.editor-content')
  if (editorElement) {
    setupLazyLoadForImages(editorElement)
  }
}

// 监听chunk变化，更新编辑器内容
watch(() => props.chunk, async (newChunk) => {
  if (editor.value && newChunk) {
    // 优先使用 edited_content，如果不存在则使用原始 content
    const contentToRender = newChunk.edited_content || newChunk.content || ''
    const newContent = marked.parse(contentToRender)
    editor.value.commands.setContent(newContent)
    originalContent.value = newContent
    hasChanges.value = false

    // 重新初始化标签
    initializeTags()

    // 设置图片延迟加载
    await setupEditorLazyLoad()
  }
}, { deep: true })

onMounted(async () => {
  // 保存原始的HTML内容
  originalContent.value = renderedContent.value

  // 初始化标签
  initializeTags()

  // 设置图片延迟加载
  await setupEditorLazyLoad()
})

// 初始化标签数据
function initializeTags() {
  console.log('🔄 初始化标签，chunk 数据:', {
    chunk_id: props.chunk.chunk_id,
    id: props.chunk.id,
    user_tag: props.chunk.user_tag,
    content_tags: props.chunk.content_tags
  })

  const contentTags = Array.isArray(props.chunk.content_tags) ? props.chunk.content_tags : []

  // 分离 AI 标签和人工标签
  // AI 标签：不带 @ 前缀
  // 人工标签：带 @ 前缀
  aiGeneratedTags.value = contentTags.filter(tag => !tag.startsWith('@'))
  const manualTagsFromContent = contentTags
    .filter(tag => tag.startsWith('@'))
    .map(tag => tag.substring(1))  // 移除 @ 前缀

  console.log('�� 从 content_tags 中分离出的人工标签:', manualTagsFromContent)

  // 第一个人工标签设为 userTagInput
  if (manualTagsFromContent.length > 0) {
    userTagInput.value = manualTagsFromContent[0]
    manualTags.value = manualTagsFromContent.slice(1)  // 其余的放到 manualTags
  } else {
    // 如果没有带前缀的人工标签，尝试从 user_tag 加载
    userTagInput.value = props.chunk.user_tag || ''
    manualTags.value = []
  }

  console.log('✅ 标签初始化完成:', {
    aiTags: aiGeneratedTags.value,
    userTag: userTagInput.value,
    manualTags: manualTags.value
  })
}

// 添加人工标签
function addManualTag() {
  console.log('🏷️  添加标签被触发，输入值:', newTag.value)

  const tag = newTag.value.trim()
  if (!tag) {
    console.warn('⚠️  标签为空，跳过')
    return
  }

  // 检查是否重复
  const allTags = [
    ...aiGeneratedTags.value,
    userTagInput.value,
    ...manualTags.value
  ].filter(Boolean)

  console.log('📋 当前所有标签:', allTags)

  if (allTags.includes(tag)) {
    console.warn('⚠️  标签已存在:', tag)
    alert('标签已存在')
    return
  }

  // 检查标签数量限制
  if (allTags.length >= CONFIG.maxChunkTags) {
    alert(`Chunk 标签数量已达上限（${CONFIG.maxChunkTags}个），请删除部分标签后再添加`)
    return
  }

  // 如果 userTagInput 为空，设置为第一个人工标签
  if (!userTagInput.value.trim()) {
    console.log('✅ 设置为主标签 (userTagInput):', tag)
    userTagInput.value = tag
  } else {
    // 否则添加到 manualTags
    console.log('✅ 添加到 manualTags:', tag)
    manualTags.value.push(tag)
  }

  newTag.value = ''
  console.log('📌 标签添加完成。当前状态:', {
    userTag: userTagInput.value,
    manualTags: manualTags.value,
    aiTags: aiGeneratedTags.value
  })
}

// 删除 AI 标签
function removeAiTag(index) {
  aiGeneratedTags.value.splice(index, 1)
}

// 删除人工标签
function removeManualTag(index) {
  manualTags.value.splice(index, 1)
}

// 清除主要人工标签
function clearUserTag() {
  userTagInput.value = ''
  // 如果有其他人工标签，将第一个提升为主标签
  if (manualTags.value.length > 0) {
    userTagInput.value = manualTags.value[0]
    manualTags.value.splice(0, 1)
  }
}

onBeforeUnmount(() => {
  editor.value?.destroy()
})

function close() {
  if (hasChanges.value) {
    if (!confirm('有未保存的更改，确定要关闭吗？')) {
      return
    }
  }
  emit('close')
}

async function vectorizeChunk() {
  if (hasChanges.value) {
    alert('请先保存修改后再向量化')
    return
  }

  if (!confirm('确定要向量化这个 chunk 吗？')) {
    return
  }

  vectorizing.value = true

  try {
    // 获取文档标签
    let documentTags = []
    if (props.currentDocument) {
      try {
        const tagsResponse = await fetch(`${CONFIG.baseURL}/api/documents/${props.currentDocument}/tags`)
        if (tagsResponse.ok) {
          const tagsData = await tagsResponse.json()
          documentTags = tagsData.tags || []
          console.log('🏷️ 文档标签:', documentTags)
        }
      } catch (err) {
        console.warn('获取文档标签失败:', err)
      }
    }

    // 向量化 chunk（将 document_tags 放在请求体中）
    const response = await fetch(`${CONFIG.baseURL}/api/chunks/${props.chunk.id}/vectorize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        document_tags: documentTags
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || '向量化失败')
    }

    const result = await response.json()
    alert(`✅ ${result.message}`)

    // 通知父组件刷新数据
    emit('save', { ...props.chunk, status: 2 })

  } catch (error) {
    console.error('向量化失败:', error)
    alert(`❌ 向量化失败: ${error.message}`)
  } finally {
    vectorizing.value = false
  }
}

async function deleteFromVector() {
  if (hasChanges.value) {
    alert('请先保存修改后再删除')
    return
  }

  if (!confirm('确定要从向量库删除这个 chunk 吗？\n删除后需要重新向量化才能被搜索到。')) {
    return
  }

  deleting.value = true

  try {
    const response = await fetch(`${CONFIG.baseURL}/api/chunks/${props.chunk.id}/vectorize`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || '删除失败')
    }

    const result = await response.json()
    alert(`✅ ${result.message}`)

    // 通知父组件刷新数据：状态改为 0（初始），清除 milvus_id
    emit('save', { ...props.chunk, status: 0, milvus_id: null })

  } catch (error) {
    console.error('从向量库删除失败:', error)
    alert(`❌ 删除失败: ${error.message}`)
  } finally {
    deleting.value = false
  }
}

async function saveAndClose() {
  // 使用 Markdown 导出（表格会保留为 HTML）
  const updatedContent = editor.value?.storage.markdown.getMarkdown()

  console.log('保存的 Markdown 内容:', updatedContent)
  console.log('保存的标签 - user_tag:', userTagInput.value)
  console.log('保存的标签 - manualTags:', manualTags.value)
  console.log('保存的标签 - content_tags (AI):', aiGeneratedTags.value)

  // 合并所有标签：AI 标签 + 人工标签
  // AI 标签保持原样，人工标签添加 @ 前缀用于区分
  const allManualTags = [userTagInput.value.trim(), ...manualTags.value].filter(Boolean)
  const manualTagsWithPrefix = allManualTags.map(tag => `@${tag}`)

  // 合并到 content_tags 中
  const finalContentTags = [...aiGeneratedTags.value, ...manualTagsWithPrefix]

  console.log('🔄 所有人工标签（带前缀）:', manualTagsWithPrefix)
  console.log('📌 最终的 content_tags（AI + 人工）:', finalContentTags)
  console.log('📌 最终的 user_tag（保留第一个人工标签）:', allManualTags[0] || null)

  // 调用后端 API 更新 chunk
  // user_tag 保存第一个人工标签（用于兼容性）
  // content_tags 包含所有标签（AI + 人工）
  try {
    const response = await fetch(`${API_BASE}/chunks/${props.chunk.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        edited_content: updatedContent,
        user_tag: allManualTags.length > 0 ? allManualTags[0] : null,
        content_tags: finalContentTags.length > 0 ? finalContentTags : null,
        editor_id: 'user_001'  // 可以后续从用户系统获取
      })
    })

    if (!response.ok) {
      throw new Error(`更新失败: ${response.statusText}`)
    }

    const updatedChunk = await response.json()

    console.log('✅ 后端返回的更新数据:', updatedChunk)

    // 重新计算用于显示的标签（移除 @ 前缀）
    const allManualTagsForEmit = [userTagInput.value.trim(), ...manualTags.value].filter(Boolean)

    const chunkToEmit = {
      ...props.chunk,
      edited_content: updatedContent,
      user_tag: allManualTagsForEmit.length > 0 ? allManualTagsForEmit[0] : null,
      content_tags: finalContentTags,  // 包含 AI 标签和带 @ 前缀的人工标签
      version: updatedChunk.version
    }

    console.log('📤 准备 emit 的数据:', chunkToEmit)

    emit('save', chunkToEmit)
    hasChanges.value = false
    emit('close')
  } catch (error) {
    console.error('保存失败:', error)
    alert(`保存失败: ${error.message}`)
  }
}

async function markAsDeprecated() {
  if (!confirm('确认将此 Chunk 标记为废弃？')) {
    return
  }

  // 调用后端 API 更新状态
  try {
    const response = await fetch(`${API_BASE}/chunks/${props.chunk.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        status: -1,
        edited_content: editor.value?.getHTML(),
        editor_id: 'user_001'
      })
    })

    if (!response.ok) {
      throw new Error(`更新失败: ${response.statusText}`)
    }

    const updatedChunk = await response.json()

    emit('save', {
      ...props.chunk,
      status: -1,
      content: editor.value?.getHTML(),
      version: updatedChunk.version
    })
    hasChanges.value = false
    emit('close')
  } catch (error) {
    console.error('废弃操作失败:', error)
    alert(`废弃操作失败: ${error.message}`)
  }
}

function addImage() {
  const url = prompt('请输入图片URL:')
  if (url) {
    editor.value?.chain().focus().setImage({ src: url }).run()
  }
}

function navigatePrev() {
  if (props.currentIndex > 0) {
    emit('navigate', props.currentIndex - 1)
  }
}

function navigateNext() {
  if (props.currentIndex < props.totalChunks - 1) {
    emit('navigate', props.currentIndex + 1)
  }
}

// ESC键关闭
function handleKeydown(e) {
  if (e.key === 'Escape') {
    close()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
})

// 暴露方法和状态给父组件
defineExpose({
  hasChanges,
  confirmAndSwitch: (newChunkId) => {
    if (hasChanges.value) {
      if (confirm('有未保存的更改，确定要切换到其他 chunk 吗？')) {
        return true
      }
      return false
    }
    return true
  }
})
</script>

<style scoped>
.chunk-editor-fullscreen {
  height: 100%;
  background: white;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  background: #34495e;
  color: white;
  border-bottom: 2px solid #2c3e50;
  flex-shrink: 0;
}

/* 标签管理区域 */
.tags-section {
  padding: 12px 20px;
  background: #f8f9fa;
  border-bottom: 1px solid #dee2e6;
  flex-shrink: 0;
}

.tags-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tags-row > label {
  font-size: 12px;
  font-weight: 600;
  color: #495057;
}

.tags-container {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  background: white;
  min-height: 38px;
  align-items: center;
}

.tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.2s;
}

/* AI 生成的标签（带圆点，淡蓝色） */
.tag.ai-tag {
  background: #e8f4f8;
  color: #0277bd;
  border: 1px solid #b3e5fc;
}

.ai-dot {
  font-size: 8px;
  color: #0277bd;
}

/* 人工添加的标签（无圆点，淡紫色，可编辑） */
.tag.manual-tag {
  background: #f3e5f5;
  color: #6a1b9a;
  border: 1px solid #ce93d8;
}

.tag-remove {
  background: none;
  border: none;
  color: inherit;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  padding: 0 2px;
  margin-left: 2px;
  opacity: 0.6;
  transition: opacity 0.2s;
}

.tag-remove:hover {
  opacity: 1;
}

.tag-input-inline {
  flex: 1;
  min-width: 150px;
  border: none;
  outline: none;
  font-size: 13px;
  padding: 4px;
}

.tag-input-inline::placeholder {
  color: #adb5bd;
  font-size: 12px;
}

.tag-legend {
  display: flex;
  gap: 16px;
  font-size: 11px;
  color: #6c757d;
  padding-left: 8px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.legend-item .ai-dot {
  font-size: 8px;
  color: #0277bd;
}

.editor-title h3 {
  margin: 0 0 6px 0;
  font-size: 16px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.atomic-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.5px;
  box-shadow: 0 2px 4px rgba(102, 126, 234, 0.3);
}

.chunk-meta {
  font-size: 11px;
  opacity: 0.9;
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.meta-separator {
  opacity: 0.5;
}

.vectorized-status {
  display: inline-flex;
  align-items: center;
  background: #4CAF50;
  color: white;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
}

.btn-vectorize {
  background: #2196F3;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.2s;
}

.btn-vectorize:hover:not(:disabled) {
  background: #1976D2;
}

.btn-vectorize:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.btn-delete-vector {
  background: #f44336;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.2s;
}

.btn-delete-vector:hover:not(:disabled) {
  background: #d32f2f;
}

.btn-delete-vector:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.atomic-meta {
  color: #ffd700;
  font-weight: 600;
}

.editor-actions {
  display: flex;
  gap: 12px;
}

.btn-save,
.btn-close,
.btn-deprecate,
.btn-history {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-deprecate {
  background: #e74c3c;
  color: white;
}

.btn-deprecate:hover:not(:disabled) {
  background: #c0392b;
}

.btn-deprecate:disabled {
  background: #95a5a6;
  cursor: not-allowed;
  opacity: 0.7;
}

.btn-save {
  background: #27ae60;
  color: white;
}

.btn-save:hover {
  background: #229954;
}

.btn-close {
  background: rgba(255, 255, 255, 0.2);
  color: white;
}

.btn-close:hover {
  background: rgba(255, 255, 255, 0.3);
}

.btn-history {
  background: #9b59b6;
  color: white;
}

.btn-history:hover {
  background: #8e44ad;
}

.editor-toolbar {
  display: flex;
  gap: 4px;
  padding: 8px 20px;
  background: #f8f9fa;
  border-bottom: 1px solid #dee2e6;
  flex-wrap: wrap;
  flex-shrink: 0;
}

.toolbar-btn {
  padding: 6px 12px;
  border: 1px solid #dee2e6;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
  min-width: 36px;
}

.toolbar-btn:hover:not(:disabled) {
  background: #e9ecef;
  border-color: #adb5bd;
}

.toolbar-btn.is-active {
  background: #3498db;
  color: white;
  border-color: #2980b9;
}

.toolbar-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.toolbar-divider {
  width: 1px;
  background: #dee2e6;
  margin: 0 8px;
}

.editor-container {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  min-height: 0;
}

.editor-content {
  max-width: 100%;
  margin: 0 auto;
}

.editor-footer {
  padding: 10px 20px;
  background: #f8f9fa;
  border-top: 1px solid #dee2e6;
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.footer-info {
  font-size: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.unsaved-indicator {
  color: #e74c3c;
  font-weight: 500;
}

.saved-indicator {
  color: #27ae60;
  font-weight: 500;
}

.chunk-position {
  color: #7f8c8d;
  font-size: 11px;
}

.nav-btn {
  padding: 6px 14px;
  background: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s;
}

.nav-btn:hover:not(:disabled) {
  background: #2980b9;
}

.nav-btn:disabled {
  background: #bdc3c7;
  cursor: not-allowed;
  opacity: 0.6;
}

/* TipTap编辑器样式 */
:deep(.ProseMirror) {
  min-height: 300px;
  padding: 16px;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  background: white;
  outline: none;
  font-size: 14px;
  line-height: 1.6;
}

:deep(.ProseMirror:focus) {
  border-color: #3498db;
  box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1);
}

:deep(.ProseMirror p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  float: left;
  color: #adb5bd;
  pointer-events: none;
  height: 0;
}

:deep(.ProseMirror h1) {
  font-size: 2em;
  font-weight: bold;
  margin-top: 0.5em;
  margin-bottom: 0.5em;
}

:deep(.ProseMirror h2) {
  font-size: 1.5em;
  font-weight: bold;
  margin-top: 0.5em;
  margin-bottom: 0.5em;
}

:deep(.ProseMirror h3) {
  font-size: 1.2em;
  font-weight: bold;
  margin-top: 0.5em;
  margin-bottom: 0.5em;
}

:deep(.ProseMirror ul),
:deep(.ProseMirror ol) {
  padding-left: 1.5em;
  margin: 0.5em 0;
}

:deep(.ProseMirror code) {
  background: #f8f9fa;
  padding: 0.2em 0.4em;
  border-radius: 3px;
  font-family: monospace;
  font-size: 0.9em;
}

:deep(.ProseMirror pre) {
  background: #282c34;
  color: #abb2bf;
  padding: 1em;
  border-radius: 8px;
  overflow-x: auto;
  font-family: monospace;
  margin: 1em 0;
}

:deep(.ProseMirror pre code) {
  background: none;
  padding: 0;
  color: inherit;
}

/* 表格样式 */
:deep(.ProseMirror table) {
  border-collapse: collapse;
  width: 100%;
  margin: 1em 0;
  overflow: hidden;
  table-layout: fixed;
}

:deep(.ProseMirror table td),
:deep(.ProseMirror table th) {
  border: 2px solid #ced4da;
  padding: 8px 12px;
  vertical-align: top;
  box-sizing: border-box;
  position: relative;
  min-width: 1em;
}

:deep(.ProseMirror table th) {
  background-color: #f8f9fa;
  font-weight: bold;
  text-align: left;
}

:deep(.ProseMirror table .selectedCell) {
  background-color: #e3f2fd;
}

:deep(.ProseMirror table .column-resize-handle) {
  position: absolute;
  right: -2px;
  top: 0;
  bottom: 0;
  width: 4px;
  background-color: #3498db;
  pointer-events: none;
}

:deep(.ProseMirror table p) {
  margin: 0;
}

/* 图片样式 */
:deep(.ProseMirror img) {
  max-width: 100%;
  max-height: 200px;
  height: auto;
  display: block;
  margin: 1em auto;
  border-radius: 4px;
  cursor: pointer;
  object-fit: contain;
}

:deep(.ProseMirror img.ProseMirror-selectednode) {
  outline: 3px solid #3498db;
}
</style>
