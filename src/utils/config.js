export const CONFIG = {
  baseURL: 'http://localhost:8000',  // API 服务器地址
  chatURL: 'http://localhost:3000',  // versa-chat-view 聊天窗口地址
  jsonPath: null,  // 首次进入不自动加载，让用户从文档选择器选择
  mdPath: './1-CP Series(CP1.2-W、1.5-W) Product Brochure V2.0-20240722.md',
  colors: [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
    '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52BE80'
  ],
  showImages: true,
  maxDocumentTags: 10,  // 文档标签最大数量
  maxChunkTags: 10      // Chunk 标签最大数量（AI标签 + 人工标签）
}

export const TAG_COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
  '#1abc9c', '#e67e22', '#34495e', '#16a085', '#c0392b',
  '#8e44ad', '#27ae60'
]
