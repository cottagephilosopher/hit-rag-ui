import { ref } from 'vue'

const toasts = ref([])
let toastId = 0

export function useToast() {
  const showToast = (message, type = 'info', duration = 4000) => {
    const id = toastId++

    // 解析消息，提取标题和内容
    let title = ''
    let msg = message

    // 如果消息以 ✅ ❌ ⚠️ ℹ️ 开头，移除这些图标（因为我们会自动添加）
    msg = msg.replace(/^[✅❌⚠️ℹ️]\s*/, '')

    // 如果消息包含换行，第一行作为标题
    const lines = msg.split('\n')
    if (lines.length > 1 && lines[0].length < 50) {
      title = lines[0]
      msg = lines.slice(1).join('\n').trim()
    }

    const toast = {
      id,
      message: msg,
      title,
      type
    }

    toasts.value.push(toast)

    // 自动移除
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id)
      }, duration)
    }

    return id
  }

  const removeToast = (id) => {
    const index = toasts.value.findIndex(t => t.id === id)
    if (index > -1) {
      toasts.value.splice(index, 1)
    }
  }

  const success = (message, duration) => showToast(message, 'success', duration)
  const error = (message, duration) => showToast(message, 'error', duration)
  const warning = (message, duration) => showToast(message, 'warning', duration)
  const info = (message, duration) => showToast(message, 'info', duration)

  return {
    toasts,
    showToast,
    removeToast,
    success,
    error,
    warning,
    info
  }
}

// 导出单例
const { showToast, removeToast, success, error, warning, info } = useToast()
export { toasts, showToast, removeToast, success, error, warning, info }
