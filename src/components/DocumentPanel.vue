<template>
  <div class="panel left">
    <div class="panel-header">
      📝 原始 Markdown 文档
    </div>
    <div class="panel-content">
      <div v-if="loadingImages" class="loading-images">
        {{ loadingMessage }}
      </div>
      <div v-else-if="!chunks || chunks.length === 0" class="empty-state">
        <div class="empty-icon">📄</div>
        <p class="empty-title">暂无文档</p>
        <p class="empty-text">请从左侧选择一个文档查看</p>
      </div>
      <div v-else id="original-content">
        <div
          v-for="chunk in chunks"
          :key="chunk.chunk_id"
          class="original-chunk clickable"
          :data-chunk-id="chunk.chunk_id"
          @click="handleChunkClick(chunk.chunk_id)"
        >
          <div class="markdown-content" v-html="renderChunk(chunk)"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, nextTick } from 'vue'
import { marked } from 'marked'
import { useLazyImage } from '../composables/useLazyImage'

const props = defineProps({
  chunks: Array,
  loadingImages: Boolean,
  loadingMessage: String
})

const emit = defineEmits(['chunk-click'])

const { setupLazyLoadForImages } = useLazyImage()

function renderChunk(chunk) {
  return marked.parse(chunk.content || '')
}

function handleChunkClick(chunkId) {
  emit('chunk-click', chunkId)
}

// 当 chunks 更新后，设置图片延迟加载
watch(() => props.chunks, async () => {
  await nextTick()
  const container = document.getElementById('original-content')
  if (container) {
    setupLazyLoadForImages(container)
    console.log('📄 DocumentPanel: 已设置图片延迟加载')
  }
}, { immediate: true })

onMounted(() => {
  const container = document.getElementById('original-content')
  if (container) {
    setupLazyLoadForImages(container)
  }
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
</style>
