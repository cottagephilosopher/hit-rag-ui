<template>
  <div class="tags-modal" :class="{ show: show }" @click.self="$emit('close')">
    <div class="tags-modal-content">
      <div class="tags-modal-header">
        <h3>📑 所有文档标签 (共 {{ tags.length }} 个)</h3>
        <button class="modal-close" @click="$emit('close')">×</button>
      </div>
      <div class="tags-modal-body">
        <!-- 现有标签 -->
        <span
          v-for="tag in tags"
          :key="tag"
          class="doc-tag"
          :style="{ background: getTagColor(tag) }"
        >
          {{ tag }}
          <span class="tag-remove" @click="$emit('remove-tag', tag)">×</span>
        </span>

        <!-- 添加标签按钮/输入框 -->
        <span v-if="!showInput" class="add-tag-trigger" @click="showInputAndFocus">
          + 添加标签
        </span>
        <span v-else class="add-tag-input-wrapper">
          <input
            ref="tagInputRef"
            v-model="newTagInput"
            type="text"
            class="tag-input-inline"
            @keypress.enter="handleAddTag"
            @blur="handleBlur"
            placeholder="输入标签名..."
            style="padding: 6px 10px; border: 1px solid #3498db; border-radius: 4px; font-size: 13px; outline: none; min-width: 150px;"
          />
          <button
            @click="handleAddTag"
            style="margin-left: 4px; padding: 6px 12px; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;"
          >
            ✓
          </button>
          <button
            @click="cancelAdd"
            style="margin-left: 4px; padding: 6px 12px; background: #95a5a6; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;"
          >
            ✕
          </button>
        </span>

        <p v-if="tags.length === 0" style="color: #7f8c8d; text-align: center; width: 100%;">
          暂无标签，点击"+ 添加标签"开始添加
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick } from 'vue'
import { CONFIG } from '../utils/config'

defineProps({
  show: Boolean,
  tags: Array,
  getTagColor: Function
})

const emit = defineEmits(['close', 'remove-tag', 'add-tag'])

const newTagInput = ref('')
const showInput = ref(false)
const tagInputRef = ref(null)

async function handleAddTag() {
  const value = newTagInput.value.trim()
  if (value) {
    emit('add-tag', value)
    newTagInput.value = ''
    showInput.value = false
  }
}

function cancelAdd() {
  newTagInput.value = ''
  showInput.value = false
}

function handleBlur() {
  // 延迟关闭，以便按钮点击事件能触发
  setTimeout(() => {
    if (!newTagInput.value.trim()) {
      showInput.value = false
    }
  }, 200)
}

// 当显示输入框时自动聚焦
async function showInputAndFocus() {
  showInput.value = true
  await nextTick()
  tagInputRef.value?.focus()
}
</script>

<style scoped>
.add-tag-trigger {
  display: inline-flex;
  align-items: center;
  padding: 6px 12px;
  background: #3498db;
  color: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.2s;
  user-select: none;
}

.add-tag-trigger:hover {
  background: #2980b9;
}

.add-tag-input-wrapper {
  display: inline-flex;
  align-items: center;
  gap: 0;
}

.tag-input-inline {
  font-family: inherit;
}
</style>
