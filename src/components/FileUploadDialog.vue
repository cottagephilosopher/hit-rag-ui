<template>
  <div class="dialog-overlay" @click.self="$emit('close')">
    <div class="dialog-container">
      <div class="dialog-header">
        <h2>上传文件转换为 Markdown</h2>
        <button @click="$emit('close')" class="close-btn">×</button>
      </div>

      <div class="dialog-body">
        <!-- 上传区域 -->
        <div
          class="upload-area"
          :class="{ 'dragging': isDragging, 'disabled': uploading }"
          @drop.prevent="handleDrop"
          @dragover.prevent="isDragging = true"
          @dragleave.prevent="isDragging = false"
          @click="!uploading && $refs.fileInput.click()"
        >
          <input
            ref="fileInput"
            type="file"
            :accept="acceptedFileTypes"
            @change="handleFileSelect"
            style="display: none"
            :disabled="uploading"
          />

          <div v-if="!selectedFile" class="upload-placeholder">
            <div class="upload-icon">📁</div>
            <p class="upload-text">拖拽文件到此处或点击选择文件</p>
            <p class="upload-hint">支持格式: PDF, DOCX, PPTX, XLSX, JPG, PNG</p>
            <p class="upload-hint-secondary">文件将通过 MinerU 转换为 Markdown 并自动处理</p>
          </div>

          <div v-else class="file-info">
            <div class="file-icon">📄</div>
            <div class="file-details">
              <div class="file-name">{{ selectedFile.name }}</div>
              <div class="file-size">{{ formatFileSize(selectedFile.size) }}</div>
            </div>
            <button
              v-if="!uploading"
              @click.stop="selectedFile = null"
              class="remove-file-btn"
            >
              ×
            </button>
          </div>
        </div>

        <!-- 上传进度 -->
        <div v-if="uploading" class="upload-progress">
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: progress + '%' }"></div>
          </div>
          <div class="progress-text">{{ statusText }}</div>
        </div>

        <!-- 转换状态 -->
        <div v-if="convertStatus" class="convert-status" :class="convertStatus.type">
          <span class="status-icon">{{ getStatusIcon(convertStatus.type) }}</span>
          <span class="status-message">{{ convertStatus.message }}</span>
        </div>
      </div>

      <div class="dialog-footer">
        <button
          @click="$emit('close')"
          class="btn btn-cancel"
          :disabled="uploading"
        >
          取消
        </button>
        <button
          @click="handleUpload"
          class="btn btn-primary"
          :disabled="!selectedFile || uploading"
        >
          {{ uploading ? '上传中...' : '上传并转换' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { API_BASE } from '@/utils/config'

const emit = defineEmits(['close', 'upload-success'])

const isDragging = ref(false)
const selectedFile = ref(null)
const uploading = ref(false)
const progress = ref(0)
const statusText = ref('')
const convertStatus = ref(null)
const uploadId = ref(null)

const acceptedFileTypes = '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png'

function handleDrop(e) {
  isDragging.value = false
  if (uploading.value) return

  const files = e.dataTransfer.files
  if (files.length > 0) {
    selectedFile.value = files[0]
  }
}

function handleFileSelect(e) {
  const files = e.target.files
  if (files.length > 0) {
    selectedFile.value = files[0]
  }
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
}

function getStatusIcon(type) {
  const icons = {
    'success': '✅',
    'error': '❌',
    'converting': '⏳',
    'warning': '⚠️'
  }
  return icons[type] || 'ℹ️'
}

async function handleUpload() {
  if (!selectedFile.value || uploading.value) return

  try {
    uploading.value = true
    progress.value = 0
    statusText.value = '准备上传...'
    convertStatus.value = null

    const formData = new FormData()
    formData.append('file', selectedFile.value)

    // 上传文件
    statusText.value = '上传文件中...'
    const response = await fetch(`${API_BASE}/upload/file`, {
      method: 'POST',
      body: formData
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || '上传失败')
    }

    const result = await response.json()
    uploadId.value = result.id

    progress.value = 50
    statusText.value = '文件上传成功，开始转换...'

    // 轮询转换状态
    await pollConversionStatus()

  } catch (error) {
    console.error('上传失败:', error)
    convertStatus.value = {
      type: 'error',
      message: `上传失败: ${error.message}`
    }
    uploading.value = false
  }
}

async function pollConversionStatus() {
  const maxAttempts = 120 // 最多等待10分钟（120 * 5秒）
  let attempts = 0

  const pollInterval = setInterval(async () => {
    try {
      attempts++

      if (attempts > maxAttempts) {
        clearInterval(pollInterval)
        convertStatus.value = {
          type: 'error',
          message: '⏱️ 转换超时（超过10分钟），请稍后手动查看转换状态'
        }
        uploading.value = false
        return
      }

      const response = await fetch(`${API_BASE}/upload/${uploadId.value}/status`)
      if (!response.ok) throw new Error('查询状态失败')

      const status = await response.json()

      if (status.status === 'pending') {
        progress.value = 10
        statusText.value = '准备上传...'
        convertStatus.value = {
          type: 'converting',
          message: '📦 准备上传文件'
        }
      } else if (status.status === 'uploading') {
        progress.value = 30
        statusText.value = '文件上传中...'
        convertStatus.value = {
          type: 'converting',
          message: '正在上传文件到服务器'
        }
      } else if (status.status === 'converting') {
        const currentProgress = status.conversion_progress || 0
        progress.value = 40 + Math.min(currentProgress * 0.4, 40)
        statusText.value = `MinerU 转换中... ${currentProgress}%`
        convertStatus.value = {
          type: 'converting',
          message: `MinerU 正在转换文档 (${currentProgress}%)`
        }
      } else if (status.status === 'completed') {
        clearInterval(pollInterval)

        // 转换完成后，开始处理文档
        progress.value = 85
        statusText.value = '转换完成，正在处理文档...'
        convertStatus.value = {
          type: 'converting',
          message: `✅ 转换完成！文件已保存: ${status.converted_md_filename}`
        }

        // 等待并触发文档处理
        await processConvertedDocument(status.converted_md_filename)

      } else if (status.status === 'error') {
        clearInterval(pollInterval)
        convertStatus.value = {
          type: 'error',
          message: `转换失败: ${status.error_message || '未知错误'}`
        }
        uploading.value = false
      }

    } catch (error) {
      console.error('查询状态失败:', error)
      clearInterval(pollInterval)
      convertStatus.value = {
        type: 'error',
        message: `查询状态失败: ${error.message}`
      }
      uploading.value = false
    }
  }, 5000) // 每5秒查询一次
}

async function processConvertedDocument(filename) {
  try {
    // 触发文档处理
    statusText.value = '开始解析文档...'
    progress.value = 90

    const processResponse = await fetch(
      `${API_BASE}/documents/${encodeURIComponent(filename)}/process`,
      { method: 'POST' }
    )

    if (!processResponse.ok) {
      throw new Error('触发文档处理失败')
    }

    // 轮询处理状态
    statusText.value = '正在解析和切片处理...'
    await pollDocumentProcessing(filename)

  } catch (error) {
    console.error('文档处理失败:', error)
    convertStatus.value = {
      type: 'warning',
      message: `⚠️ 文件已转换，但处理失败: ${error.message}。请手动触发处理。`
    }
    uploading.value = false

    // 5秒后关闭
    setTimeout(() => {
      emit('upload-success')
    }, 5000)
  }
}

async function pollDocumentProcessing(filename) {
  const maxAttempts = 120
  let attempts = 0

  const pollInterval = setInterval(async () => {
    try {
      attempts++

      if (attempts > maxAttempts) {
        clearInterval(pollInterval)
        convertStatus.value = {
          type: 'warning',
          message: '⚠️ 文档处理超时，请手动查看处理状态'
        }
        uploading.value = false

        setTimeout(() => {
          emit('upload-success')
        }, 3000)
        return
      }

      const response = await fetch(
        `${API_BASE}/documents/${encodeURIComponent(filename)}/status`
      )

      if (!response.ok) throw new Error('查询处理状态失败')

      const status = await response.json()

      if (status.status === 'processing') {
        progress.value = 92
        statusText.value = '文档处理中（解析、切片、标签推理）...'
        convertStatus.value = {
          type: 'converting',
          message: '⏳ 正在进行智能解析和切片处理...'
        }
      } else if (status.status === 'processed') {
        clearInterval(pollInterval)
        progress.value = 100
        statusText.value = '全部完成！'
        convertStatus.value = {
          type: 'success',
          message: `🎉 处理完成！文档已就绪: ${filename}`
        }
        uploading.value = false

        // 2秒后关闭弹窗
        setTimeout(() => {
          emit('upload-success')
        }, 2000)

      } else if (status.status === 'error') {
        clearInterval(pollInterval)
        convertStatus.value = {
          type: 'error',
          message: `❌ 处理失败: ${status.error || '未知错误'}`
        }
        uploading.value = false

        setTimeout(() => {
          emit('upload-success')
        }, 3000)
      }

    } catch (error) {
      console.error('查询处理状态失败:', error)
      clearInterval(pollInterval)
      convertStatus.value = {
        type: 'warning',
        message: `⚠️ 无法查询处理状态: ${error.message}`
      }
      uploading.value = false

      setTimeout(() => {
        emit('upload-success')
      }, 3000)
    }
  }, 2000) // 每2秒查询一次
}
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.dialog-container {
  background: white;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.dialog-header {
  padding: 20px 24px;
  border-bottom: 1px solid #e1e8ed;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #f8f9fa;
}

.dialog-header h2 {
  margin: 0;
  font-size: 18px;
  color: #2c3e50;
  font-weight: 600;
}

.close-btn {
  background: transparent;
  border: none;
  font-size: 28px;
  color: #6c757d;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: rgba(0, 0, 0, 0.05);
  color: #2c3e50;
}

.dialog-body {
  padding: 24px;
  flex: 1;
  overflow-y: auto;
}

.upload-area {
  border: 2px dashed #cbd5e0;
  border-radius: 8px;
  padding: 40px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;
  background: #f8f9fa;
  min-height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.upload-area:hover:not(.disabled) {
  border-color: #2196f3;
  background: #f0f8ff;
}

.upload-area.dragging {
  border-color: #2196f3;
  background: #e3f2fd;
  transform: scale(1.02);
}

.upload-area.disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.upload-placeholder {
  width: 100%;
}

.upload-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.upload-text {
  font-size: 16px;
  color: #2c3e50;
  margin: 0 0 8px 0;
  font-weight: 500;
}

.upload-hint {
  font-size: 13px;
  color: #6c757d;
  margin: 0;
}

.upload-hint-secondary {
  font-size: 11px;
  color: #95a5a6;
  margin: 8px 0 0 0;
  font-style: italic;
}

.file-info {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
  padding: 16px;
  background: white;
  border-radius: 8px;
  border: 1px solid #e1e8ed;
}

.file-icon {
  font-size: 32px;
}

.file-details {
  flex: 1;
  text-align: left;
}

.file-name {
  font-size: 14px;
  color: #2c3e50;
  font-weight: 500;
  margin-bottom: 4px;
  word-break: break-all;
}

.file-size {
  font-size: 12px;
  color: #6c757d;
}

.remove-file-btn {
  background: #f8d7da;
  border: none;
  color: #721c24;
  font-size: 24px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.remove-file-btn:hover {
  background: #f5c6cb;
}

.upload-progress {
  margin-top: 20px;
}

.progress-bar {
  height: 8px;
  background: #e1e8ed;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 8px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #2196f3, #21cbf3);
  transition: width 0.3s ease;
  animation: shimmer 2s infinite;
}

@keyframes shimmer {
  0% {
    background-position: -1000px 0;
  }
  100% {
    background-position: 1000px 0;
  }
}

.progress-text {
  font-size: 13px;
  color: #6c757d;
  text-align: center;
}

.convert-status {
  margin-top: 16px;
  padding: 12px 16px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.convert-status.success {
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.convert-status.error {
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.convert-status.converting {
  background: #fff3cd;
  color: #856404;
  border: 1px solid #ffeaa7;
}

.convert-status.warning {
  background: #fff3cd;
  color: #856404;
  border: 1px solid #ffeaa7;
}

.status-icon {
  font-size: 18px;
}

.status-message {
  flex: 1;
}

.dialog-footer {
  padding: 16px 24px;
  border-top: 1px solid #e1e8ed;
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  background: #f8f9fa;
}

.btn {
  padding: 10px 24px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-cancel {
  background: white;
  color: #6c757d;
  border: 1px solid #cbd5e0;
}

.btn-cancel:hover:not(:disabled) {
  background: #f8f9fa;
  border-color: #adb5bd;
}

.btn-primary {
  background: #2196f3;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #1976d2;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(33, 150, 243, 0.3);
}
</style>
