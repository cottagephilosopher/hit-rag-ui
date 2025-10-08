<template>
  <div class="tags-modal" :class="{ show: show }" @click.self="$emit('close')">
    <div class="tags-modal-content">
      <div class="tags-modal-header">
        <h3>📑 所有文档标签</h3>
        <button class="modal-close" @click="$emit('close')">×</button>
      </div>
      <div class="tags-modal-body">
        <span
          v-for="tag in tags"
          :key="tag"
          class="doc-tag"
          :style="{ background: getTagColor(tag) }"
        >
          {{ tag }}
          <span class="tag-remove" @click="$emit('remove-tag', tag)">×</span>
        </span>
        <p v-if="tags.length === 0" style="color: #7f8c8d; text-align: center;">
          暂无标签
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  show: Boolean,
  tags: Array,
  getTagColor: Function
})

defineEmits(['close', 'remove-tag'])
</script>
