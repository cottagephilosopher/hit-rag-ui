<template>
  <div v-if="show" class="chat-overlay" :class="{ show }">
    <div class="chat-container">
      <!-- 关闭按钮 -->
      <button @click="$emit('close')" class="close-btn">✕</button>

      <!-- iframe 嵌入 versa-chat-view -->
      <iframe
        :src="chatUrl"
        class="chat-iframe"
        frameborder="0"
        allow="clipboard-write"
      ></iframe>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { CONFIG } from '../utils/config.js'

const props = defineProps({
  show: Boolean
})

const emit = defineEmits(['close', 'view-chunk'])

// versa-chat-view 运行地址
const chatUrl = computed(() => {
  return CONFIG.chatURL
})

// 监听来自 iframe 的消息（用于跨域通信）
window.addEventListener('message', (event) => {
  // 安全检查：确保消息来自 versa-chat-view
  if (event.origin !== CONFIG.chatURL) return

  // 处理来自聊天窗口的消息
  if (event.data.type === 'view-chunk') {
    emit('view-chunk', {
      chunk_id: event.data.chunk_id,
      source_file: event.data.source_file
    })
  }
})
</script>

<style scoped>
.chat-overlay {
  position: fixed;
  top: 0;
  right: -100%;
  bottom: 0;
  width: 600px;
  background: rgba(0, 0, 0, 0.3);
  transition: right 0.3s ease;
  z-index: 1000;
}

.chat-overlay.show {
  right: 0;
}

.chat-container {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  background: white;
  display: flex;
  flex-direction: column;
  box-shadow: -2px 0 10px rgba(0, 0, 0, 0.1);
}

.close-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 10;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid #e1e8ed;
  font-size: 20px;
  cursor: pointer;
  padding: 8px 12px;
  border-radius: 50%;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.close-btn:hover {
  background: white;
  transform: scale(1.1);
}

.chat-iframe {
  width: 100%;
  height: 100%;
  border: none;
}
</style>
