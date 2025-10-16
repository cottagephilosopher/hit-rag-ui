<template>
  <Transition name="toast-container">
    <div v-if="toasts.length > 0" class="toast-container">
      <TransitionGroup name="toast">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          :class="['toast', `toast-${toast.type}`]"
          @click="removeToast(toast.id)"
        >
          <div class="toast-icon">{{ getIcon(toast.type) }}</div>
          <div class="toast-content">
            <div v-if="toast.title" class="toast-title">{{ toast.title }}</div>
            <div class="toast-message">{{ toast.message }}</div>
          </div>
          <button class="toast-close" @click.stop="removeToast(toast.id)">×</button>
        </div>
      </TransitionGroup>
    </div>
  </Transition>
</template>

<script setup>
import { toasts, removeToast } from '../composables/useToast'

const getIcon = (type) => {
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  }
  return icons[type] || icons.info
}
</script>

<style scoped>
.toast-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 400px;
}

.toast {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  cursor: pointer;
  transition: all 0.3s ease;
  min-width: 300px;
  border-left: 4px solid;
}

.toast:hover {
  transform: translateX(-4px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
}

.toast-success {
  border-left-color: #2ecc71;
  background: #f0fff4;
}

.toast-error {
  border-left-color: #e74c3c;
  background: #fff5f5;
}

.toast-warning {
  border-left-color: #f39c12;
  background: #fffbf0;
}

.toast-info {
  border-left-color: #3498db;
  background: #f0f9ff;
}

.toast-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.toast-content {
  flex: 1;
  min-width: 0;
}

.toast-title {
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 4px;
  color: #2c3e50;
}

.toast-message {
  font-size: 14px;
  color: #34495e;
  word-wrap: break-word;
  white-space: pre-wrap;
}

.toast-close {
  background: none;
  border: none;
  font-size: 24px;
  line-height: 1;
  color: #95a5a6;
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  transition: color 0.2s;
}

.toast-close:hover {
  color: #2c3e50;
}

/* 动画效果 */
.toast-container-enter-active,
.toast-container-leave-active {
  transition: opacity 0.3s ease;
}

.toast-container-enter-from,
.toast-container-leave-to {
  opacity: 0;
}

.toast-enter-active {
  transition: all 0.3s ease;
}

.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

.toast-move {
  transition: transform 0.3s ease;
}
</style>
