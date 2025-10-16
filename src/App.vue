<template>
  <router-view />
  <ToastNotification />
</template>

<script setup>
import ToastNotification from './components/ToastNotification.vue'
</script>

<style scoped>
.processing-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
  backdrop-filter: blur(4px);
}

.processing-modal {
  background: white;
  padding: 40px;
  border-radius: 12px;
  text-align: center;
  max-width: 400px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
}

.processing-spinner {
  font-size: 48px;
  animation: spin 2s linear infinite;
  margin-bottom: 20px;
}

.processing-modal h3 {
  margin: 0 0 15px 0;
  color: #2c3e50;
  font-size: 20px;
}

.processing-filename {
  color: #3498db;
  font-weight: 500;
  margin: 10px 0;
  font-size: 14px;
  word-break: break-all;
}

.processing-tip {
  color: #7f8c8d;
  font-size: 13px;
  margin: 15px 0 20px 0;
}

.processing-loader {
  width: 100%;
  height: 4px;
  background: #ecf0f1;
  border-radius: 2px;
  overflow: hidden;
}

.loader-bar {
  height: 100%;
  background: linear-gradient(90deg, #3498db, #2ecc71, #3498db);
  background-size: 200% 100%;
  animation: loading 1.5s ease-in-out infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
