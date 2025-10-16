<template>
  <div class="config-page">
    <div class="config-header">
      <h1>⚙️ RAG 配置管理</h1>
      <button @click="$router.push('/')" class="back-btn">← 返回主页</button>
    </div>

    <div class="config-container">
      <div class="config-actions">
        <button @click="saveConfigs" class="btn btn-primary" :disabled="!hasChanges || isSaving">
          <span v-if="isSaving">💾 保存中...</span>
          <span v-else>💾 保存配置</span>
        </button>
        <button @click="resetToDefaults" class="btn btn-secondary" :disabled="isSaving">
          🔄 恢复默认
        </button>
        <button @click="refreshConfigs" class="btn btn-secondary" :disabled="isSaving">
          ↻ 刷新
        </button>
      </div>

      <div v-if="loading" class="loading">
        <div class="spinner">⏳</div>
        <p>加载配置中...</p>
      </div>

      <div v-else-if="error" class="error-message">
        <p>❌ {{ error }}</p>
        <button @click="refreshConfigs" class="btn btn-secondary">重试</button>
      </div>

      <div v-else class="config-sections">
        <!-- 对话配置 -->
        <div class="config-section">
          <h2>💬 对话配置</h2>
          <div class="config-items">
            <div v-for="(config, key) in groupedConfigs.chat" :key="key" class="config-item">
              <div class="config-label">
                <label :for="key">{{ config.description }}</label>
                <span class="config-key">{{ key }}</span>
              </div>
              <div class="config-input-group">
                <input
                  v-if="key.startsWith('ENABLE_')"
                  type="checkbox"
                  :id="key"
                  v-model="editedConfigs[key]"
                  @change="markAsChanged"
                  class="config-checkbox"
                />
                <input
                  v-else
                  type="number"
                  :id="key"
                  v-model.number="editedConfigs[key]"
                  :min="config.min_value"
                  :max="config.max_value"
                  :step="0.01"
                  @input="markAsChanged"
                  class="config-input"
                />
                <span v-if="key.startsWith('ENABLE_')" class="config-range">范围: [开 - 关]</span>
                <span v-else class="config-range">范围: [{{ config.min_value }} - {{ config.max_value }}]</span>
                <span v-if="key.startsWith('ENABLE_')" class="config-default">默认: {{ config.default_value === 1 ? '开' : '关' }}</span>
                <span v-else class="config-default">默认: {{ config.default_value }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 置信度阈值配置 -->
        <div class="config-section">
          <h2>🎯 置信度阈值配置</h2>
          <div class="config-items">
            <div v-for="(config, key) in groupedConfigs.threshold" :key="key" class="config-item">
              <div class="config-label">
                <label :for="key">{{ config.description }}</label>
                <span class="config-key">{{ key }}</span>
              </div>
              <div class="config-input-group">
                <input
                  type="number"
                  :id="key"
                  v-model.number="editedConfigs[key]"
                  :min="config.min_value"
                  :max="config.max_value"
                  :step="0.01"
                  @input="markAsChanged"
                  class="config-input"
                />
                <span class="config-range">范围: [{{ config.min_value }} - {{ config.max_value }}]</span>
                <span class="config-default">默认: {{ config.default_value }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 检索数量配置 -->
        <div class="config-section">
          <h2>🔍 检索数量配置</h2>
          <div class="config-items">
            <div v-for="(config, key) in groupedConfigs.retrieval" :key="key" class="config-item">
              <div class="config-label">
                <label :for="key">{{ config.description }}</label>
                <span class="config-key">{{ key }}</span>
              </div>
              <div class="config-input-group">
                <input
                  type="number"
                  :id="key"
                  v-model.number="editedConfigs[key]"
                  :min="config.min_value"
                  :max="config.max_value"
                  :step="1"
                  @input="markAsChanged"
                  class="config-input"
                />
                <span class="config-range">范围: [{{ config.min_value }} - {{ config.max_value }}]</span>
                <span class="config-default">默认: {{ config.default_value }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { API_BASE } from '../utils/config'

const router = useRouter()

const loading = ref(false)
const isSaving = ref(false)
const error = ref(null)
const originalConfigs = ref({})
const editedConfigs = ref({})
const groupedConfigs = ref({
  chat: {},
  threshold: {},
  retrieval: {}
})
const hasChanges = ref(false)

function markAsChanged() {
  hasChanges.value = true
}

async function loadConfigs() {
  loading.value = true
  error.value = null

  try {
    const response = await fetch(`${API_BASE}/config/rag`)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const data = await response.json()
    groupedConfigs.value = data.grouped || { chat: {}, threshold: {}, retrieval: {} }

    // 提取配置值
    const allConfigs = data.configs || {}
    const configValues = {}

    for (const [key, config] of Object.entries(allConfigs)) {
      // ENABLE_CHAT_MODE 使用布尔值
      if (key === 'ENABLE_CHAT_MODE') {
        configValues[key] = config.config_value === 1
      } else {
        configValues[key] = config.config_value
      }
    }

    originalConfigs.value = JSON.parse(JSON.stringify(configValues))
    editedConfigs.value = JSON.parse(JSON.stringify(configValues))
    hasChanges.value = false

    console.log('✅ 配置加载成功', configValues)
  } catch (err) {
    console.error('❌ 加载配置失败:', err)
    error.value = `加载配置失败: ${err.message}`
  } finally {
    loading.value = false
  }
}

async function saveConfigs() {
  if (!hasChanges.value) return

  isSaving.value = true
  error.value = null

  try {
    // 准备更新数据
    const updates = {}
    for (const [key, value] of Object.entries(editedConfigs.value)) {
      // ENABLE_CHAT_MODE 转换为数字
      if (key === 'ENABLE_CHAT_MODE') {
        updates[key] = value ? 1.0 : 0.0
      } else {
        updates[key] = value
      }
    }

    const response = await fetch(`${API_BASE}/config/rag/batch`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ configs: updates })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.detail || `HTTP ${response.status}`)
    }

    const result = await response.json()
    console.log('✅ 配置保存成功', result)

    // 重新加载配置
    await loadConfigs()

    alert(`✅ 成功更新 ${result.updated_count} 个配置项`)
  } catch (err) {
    console.error('❌ 保存配置失败:', err)
    error.value = `保存配置失败: ${err.message}`
    alert(`❌ 保存失败: ${err.message}`)
  } finally {
    isSaving.value = false
  }
}

async function resetToDefaults() {
  if (!confirm('确定要恢复所有配置为默认值吗？')) {
    return
  }

  isSaving.value = true
  error.value = null

  try {
    const response = await fetch(`${API_BASE}/config/rag/reset`, {
      method: 'POST'
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.detail || `HTTP ${response.status}`)
    }

    const result = await response.json()
    console.log('✅ 配置重置成功', result)

    // 重新加载配置
    await loadConfigs()

    alert(`✅ 成功重置 ${result.updated_count} 个配置项`)
  } catch (err) {
    console.error('❌ 重置配置失败:', err)
    error.value = `重置配置失败: ${err.message}`
    alert(`❌ 重置失败: ${err.message}`)
  } finally {
    isSaving.value = false
  }
}

async function refreshConfigs() {
  await loadConfigs()
}

onMounted(() => {
  loadConfigs()
})
</script>

<style scoped>
.config-page {
  min-height: 100vh;
  height: 100vh;
  background: #f5f7fa;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.config-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 24px 40px;
  color: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  flex-shrink: 0;
}

.config-header h1 {
  margin: 0;
  font-size: 28px;
  font-weight: 600;
}

.back-btn {
  padding: 10px 20px;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.back-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  border-color: rgba(255, 255, 255, 0.5);
}

.config-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 40px 20px;
  flex: 1;
  overflow-y: auto;
}

.config-actions {
  display: flex;
  gap: 12px;
  margin-bottom: 30px;
  padding: 20px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background: #f5f5f5;
  color: #333;
}

.btn-secondary:hover:not(:disabled) {
  background: #e0e0e0;
}

.btn-secondary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.loading, .error-message {
  text-align: center;
  padding: 60px 20px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.spinner {
  font-size: 48px;
  animation: spin 2s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.error-message p {
  color: #e74c3c;
  font-size: 18px;
  margin-bottom: 20px;
}

.config-sections {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.config-section {
  background: white;
  border-radius: 12px;
  padding: 30px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.config-section h2 {
  margin: 0 0 24px 0;
  font-size: 20px;
  font-weight: 600;
  color: #2c3e50;
  border-bottom: 3px solid #667eea;
  padding-bottom: 12px;
}

.config-items {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.config-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
  transition: all 0.3s ease;
}

.config-item:hover {
  background: #e9ecef;
}

.config-label {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.config-label label {
  font-size: 15px;
  font-weight: 500;
  color: #34495e;
}

.config-key {
  font-size: 12px;
  color: #95a5a6;
  font-family: monospace;
  background: #e9ecef;
  padding: 2px 8px;
  border-radius: 4px;
  display: inline-block;
}

.config-input-group {
  display: flex;
  align-items: center;
  gap: 16px;
}

.config-input {
  padding: 10px 14px;
  border: 2px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  width: 120px;
  transition: all 0.3s ease;
}

.config-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.config-checkbox {
  width: 24px;
  height: 24px;
  cursor: pointer;
}

.config-range {
  font-size: 13px;
  color: #7f8c8d;
  font-family: monospace;
  white-space: nowrap;
}

.config-default {
  font-size: 13px;
  color: #95a5a6;
  white-space: nowrap;
}
</style>
