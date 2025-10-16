<template>
  <div class="tags-container">
    <input
      type="text"
      class="tag-input"
      :value="inputValue"
      @input="$emit('update:inputValue', $event.target.value)"
      @keypress.enter="handleAddTag"
      placeholder="+ 添加标签"
    />
    <button
      v-if="tags.length > 6"
      class="more-tags-btn"
      @click="$emit('open-modal')"
    >
      + {{ tags.length - 6 }} more
    </button>
    <div class="tags-display">
      <span
        v-for="tag in visibleTags"
        :key="tag"
        class="doc-tag"
        :style="{ background: getTagColor(tag) }"
      >
        {{ tag }}
        <span class="tag-remove" @click="$emit('remove-tag', tag)">×</span>
      </span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { warning as showWarning } from '../composables/useToast'
import { CONFIG } from '../utils/config'

const props = defineProps({
  tags: Array,
  inputValue: String,
  getTagColor: Function
})

const emit = defineEmits(['add-tag', 'remove-tag', 'open-modal', 'update:inputValue'])

const visibleTags = computed(() => props.tags.slice(0, 6))

function handleAddTag(event) {
  const value = event.target.value.trim()
  if (value) {
    // 检查标签数量限制
    if (props.tags.length >= CONFIG.maxDocumentTags) {
      showWarning(`文档标签数量已达上限（${CONFIG.maxDocumentTags}个），请删除部分标签后再添加`)
      return
    }
    emit('add-tag', value)
  }
}
</script>
