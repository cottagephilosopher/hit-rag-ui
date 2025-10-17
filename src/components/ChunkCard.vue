<template>
  <div
    ref="chunkCardRef"
    class="chunk-item"
    :class="{
      'deprecated': chunk.status === -1,
      'vectorized': chunk.status === 2,
      'selected': selected,
      'selection-mode': selectionMode
    }"
    :data-chunk-id="chunk.chunk_id"
    @click="$emit('click', chunk)"
  >
    <div class="chunk-header">
      <div class="chunk-id">
        <span
          class="color-indicator"
          :style="{ backgroundColor: color }"
        ></span>
        <span v-if="selectionMode" class="selection-checkbox">
          {{ selected ? '✅' : (chunk.status === -1 || chunk.status === 2 ? '🚫' : '☑️') }}
        </span>
        Chunk #{{ chunk.chunk_id }}
        <span v-if="chunk.is_atomic" class="atomic-badge-mini" :title="`ATOMIC ${chunk.atomic_type} 块`">
          ⚛️
        </span>
      </div>
      <div class="chunk-tokens">
        <span class="token-range">
          <span>{{ chunk.token_start }}</span>
          <span class="token-range-arrow">→</span>
          <span>{{ chunk.token_end }}</span>
        </span>
        <span class="token-separator">|</span>
        <span class="token-count" :title="`当前切片共 ${chunk.token_count} tokens`">
          📊 {{ chunk.token_count }}
        </span>
        <span v-if="chunk.is_atomic" class="atomic-type-label" :title="`ATOMIC ${chunk.atomic_type} 块`">
          {{ chunk.atomic_type?.toUpperCase() }}
        </span>
        <span v-if="chunk.status === 2" class="vectorized-badge" title="已向量化">
          ✅ 已向量化
        </span>
      </div>
    </div>

    <div class="chunk-tags" v-if="aiTags.length > 0 || manualTags.length > 0">
      <!-- AI 生成的标签（user_tag + content_tags 中不带 @ 前缀，带圆点） -->
      <span
        v-for="tag in aiTags"
        :key="'ai-' + tag"
        class="tag ai-tag"
        :title="'AI 生成的标签'"
      >
        <span class="ai-dot">●</span> {{ tag }}
      </span>
      <!-- 人工添加的标签（content_tags 中带 @ 前缀，移除前缀显示，无圆点） -->
      <span
        v-for="tag in manualTags"
        :key="'manual-' + tag"
        class="tag manual-tag"
        :title="'人工添加的标签'"
      >
        {{ tag }}
      </span>
    </div>

    <div class="chunk-content">
      <div class="markdown-content" v-html="renderedContent"></div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, nextTick, watch } from 'vue'
import { marked } from 'marked'
import { useLazyImage } from '../composables/useLazyImage'

const props = defineProps({
  chunk: Object,
  color: String,
  selected: Boolean,
  selectionMode: Boolean
})

defineEmits(['click'])

const { setupLazyLoadForImages } = useLazyImage()
const chunkCardRef = ref(null)

// 分离 AI 标签和人工标签
// AI 标签来源：1) user_tag 字段（LLM 主标签） 2) content_tags 中不带 @ 前缀的标签
const aiTags = computed(() => {
  if (!Array.isArray(props.chunk.content_tags)) {
    // 如果没有 content_tags，只返回 user_tag（如果有的话）
    return props.chunk.user_tag ? [props.chunk.user_tag] : []
  }

  const aiTagsFromContent = props.chunk.content_tags.filter(tag => !tag.startsWith('@'))

  // 合并 user_tag 和 content_tags 中的 AI 标签（去重）
  const allAiTags = new Set()
  if (props.chunk.user_tag) {
    allAiTags.add(props.chunk.user_tag)
  }
  aiTagsFromContent.forEach(tag => allAiTags.add(tag))

  return Array.from(allAiTags)
})

const manualTags = computed(() => {
  if (!Array.isArray(props.chunk.content_tags)) return []
  // 人工标签：带 @ 前缀，移除前缀显示
  return props.chunk.content_tags
    .filter(tag => tag.startsWith('@'))
    .map(tag => tag.substring(1))
})

const renderedContent = computed(() => {
  // 优先使用 edited_content，如果不存在则使用原始 content
  const content = props.chunk.edited_content || props.chunk.content || ''
  const truncated = content.length > 500 ? content.substring(0, 500) + '...' : content
  return marked.parse(truncated)
})

// 设置图片延迟加载
async function setupLazyLoad() {
  await nextTick()
  if (chunkCardRef.value) {
    const markdownContent = chunkCardRef.value.querySelector('.markdown-content')
    if (markdownContent) {
      setupLazyLoadForImages(markdownContent)
    }
  }
}

// 监听 chunk 内容变化
watch(() => [props.chunk.content, props.chunk.edited_content], () => {
  setupLazyLoad()
}, { immediate: true })

onMounted(() => {
  setupLazyLoad()
})
</script>

<style scoped>
.chunk-id {
  display: flex;
  align-items: center;
  gap: 6px;
}

.atomic-badge-mini {
  font-size: 14px;
  opacity: 0.9;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 0.9;
  }
  50% {
    opacity: 1;
    transform: scale(1.1);
  }
}

.chunk-tokens {
  display: flex;
  align-items: center;
  gap: 6px;
}

.atomic-type-label {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.3px;
  box-shadow: 0 1px 3px rgba(102, 126, 234, 0.3);
}

.vectorized-badge {
  background: #4CAF50;
  color: white;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 600;
}

.chunk-item.selected {
  border: 2px solid #2196F3;
  background: #E3F2FD;
}

.chunk-item.selection-mode {
  cursor: pointer;
}

.chunk-item.vectorized {
  opacity: 0.7;
}

.selection-checkbox {
  font-size: 14px;
  margin-right: 4px;
}

/* 标签样式 */
.chunk-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 8px 0;
}

.tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.2s ease;
}

/* 用户标签（章节标题，蓝色背景） */
.tag.user-tag {
  background: #e3f2fd;
  color: #1976d2;
  border: 1px solid #90caf9;
  font-weight: 600;
}

/* AI 标签（浅蓝色背景） */
.tag.ai-tag {
  background: #e8f4f8;
  color: #0277bd;
  border: 1px solid #b3e5fc;
}

.ai-dot {
  font-size: 8px;
  color: #0277bd;
}

/* 人工标签（浅紫色背景） */
.tag.manual-tag {
  background: #f3e5f5;
  color: #6a1b9a;
  border: 1px solid #ce93d8;
}

.tag:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}
</style>
