# RAG 文档切分可视化系统

一个集成了文档预处理、智能切分和可视化交互的完整 RAG（检索增强生成）文档管理系统。

## 📋 目录

- [系统概述](#系统概述)
- [系统架构](#系统架构)
- [项目结构](#项目结构)
- [核心流程](#核心流程)
- [前端架构](#前端架构)
- [后端架构](#后端架构)
- [数据流与状态管理](#数据流与状态管理)
- [安装与运行](#安装与运行)
- [功能说明](#功能说明)
- [技术栈](#技术栈)

---

## 系统概述

本系统是一个完整的 RAG 文档预处理和可视化解决方案，包含以下核心功能：

1. **智能文档切分**：基于 LLM 的三阶段文档切分流水线
2. **可视化管理**：Web 界面选择、查看和管理切分后的文档
3. **实时处理**：自动触发后台处理任务并实时更新状态
4. **富文本编辑**：基于 TipTap 的 Chunk 内容编辑，支持表格、图片等
5. **状态追踪**：Chunk 级别的状态管理（初始/确认/废弃/向量化）

---

## 系统架构

```
┌─────────────────────────────────────────────────────────────────┐
│                         用户界面层                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ 文档选择面板  │  │  原文展示    │  │  Chunks面板   │          │
│  │ - 文档列表   │  │  - Markdown  │  │  - 卡片列表   │          │
│  │ - 状态显示   │  │  - 高亮定位  │  │  - 编辑器     │          │
│  │ - 触发处理   │  │  - 图片渲染  │  │  - 状态管理   │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              ↓ ↑
                         Vue 3 + Vite
                              ↓ ↑
┌─────────────────────────────────────────────────────────────────┐
│                      FastAPI 后端服务                            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  API 接口层                                               │  │
│  │  • GET  /api/documents           - 文档列表              │  │
│  │  • GET  /api/documents/{name}/status - 状态查询          │  │
│  │  • POST /api/documents/{name}/process - 触发处理         │  │
│  │  • DELETE /api/documents/{name}/output - 删除输出        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  后台任务层 (Background Tasks)                            │  │
│  │  • 调用 main.py 执行三阶段切分流水线                       │  │
│  │  • 状态追踪与错误处理                                      │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↓ ↑
┌─────────────────────────────────────────────────────────────────┐
│                   RAG 预处理核心引擎                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Stage 1     │→ │  Stage 2     │→ │  Stage 3     │          │
│  │  基线切分     │  │  清洗映射     │  │  精细定位     │          │
│  │              │  │              │  │              │          │
│  │ • 粗切分     │  │ • LLM清洗    │  │ • LLM精切    │          │
│  │ • Token计数  │  │ • Token映射  │  │ • 精确定位    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                              ↓                                   │
│                    Output JSON 文件                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 项目结构

```
rag_preprocessor/
│
├── hit-rag/                          # 后端预处理引擎
│   ├── api_server.py                  # FastAPI 服务器
│   ├── main.py                        # 主程序入口
│   ├── config.py                      # 配置管理
│   ├── processing_stages/             # 三阶段处理流水线
│   │   ├── stage1_baseline.py         # 阶段1：基线切分
│   │   ├── stage2_clean_map.py        # 阶段2：清洗和Token映射
│   │   └── stage3_refine_locate.py    # 阶段3：精细切分和定位
│   ├── llm_api/                       # LLM 接口封装
│   │   ├── llm_client.py              # LLM 客户端
│   │   └── prompt_templates.py        # Prompt 模板
│   ├── tokenizer/                     # Token 处理工具
│   │   ├── tokenizer_client.py        # Tokenizer 客户端
│   │   └── token_mapper.py            # Token 映射器
│   ├── pyproject.toml                 # Python 依赖
│   └── .env                           # 环境变量（API keys）
│
├── rag-visualizer/                    # 前端可视化界面
│   ├── public/                        # 静态资源
│   │   └── output/                    # 处理后的 JSON 输出
│   │       └── *.json                 # Chunk 数据文件
│   │
│   ├── src/
│   │   ├── components/                # Vue 组件
│   │   │   ├── DocumentSelector.vue  # 文档选择器（左侧面板）
│   │   │   ├── DocumentPanel.vue     # 原文展示面板（中间）
│   │   │   ├── ChunksPanel.vue       # Chunks 列表面板（右侧）
│   │   │   ├── ChunkCard.vue         # 单个 Chunk 卡片
│   │   │   ├── ChunkEditor.vue       # Chunk 富文本编辑器
│   │   │   ├── TagManager.vue        # 标签管理器
│   │   │   └── TagModal.vue          # 标签弹窗
│   │   │
│   │   ├── composables/               # 组合式函数（逻辑复用）
│   │   │   ├── useImageLoader.js     # 图片加载逻辑
│   │   │   ├── useTags.js            # 标签管理逻辑
│   │   │   └── useHighlight.js       # 高亮定位逻辑
│   │   │
│   │   ├── utils/
│   │   │   └── config.js             # 前端配置
│   │   │
│   │   ├── App.vue                   # 根组件
│   │   ├── main.js                   # 应用入口
│   │   └── style.css                 # 全局样式
│   │
│   ├── index.html                    # HTML 模板
│   ├── package.json                  # Node 依赖
│   ├── vite.config.js                # Vite 配置
│   └── README.md                     # 本文档
│
└── all-md/                           # 原始 Markdown 文档目录
    └── *.md                          # 待处理的文档
```

---

## 核心流程

### 1. 从 .md 文件到切分输出

#### 流程图

```
[原始 .md 文件]
      ↓
┌─────────────────────────────────────┐
│  Stage 1: 基线切分 (Baseline Split) │
├─────────────────────────────────────┤
│ • 按标题、段落粗略切分               │
│ • 控制每个 chunk 的 token 范围      │
│ • 生成初步 chunks 列表               │
└─────────────────────────────────────┘
      ↓ [粗切分的 chunks]
┌─────────────────────────────────────┐
│  Stage 2: 智能清洗与映射             │
├─────────────────────────────────────┤
│ • LLM 清洗每个 chunk 内容           │
│ • 移除无意义内容（导航、页脚等）     │
│ • Token 级别的正反向映射             │
│   - 原文 token → 清洗后 token       │
│   - 清洗后 token → 原文 token       │
└─────────────────────────────────────┘
      ↓ [清洗后的 chunks + 映射表]
┌─────────────────────────────────────┐
│  Stage 3: 精细切分与定位             │
├─────────────────────────────────────┤
│ • LLM 对每个 chunk 进一步细分       │
│ • 生成语义完整的 mini-chunks        │
│ • 通过映射表定位到原文位置           │
│ • 计算精确的 token 范围             │
└─────────────────────────────────────┘
      ↓
[最终 JSON 输出]
{
  "metadata": { ... },
  "chunks": [
    {
      "chunk_id": 0,
      "content": "...",
      "token_start": 0,
      "token_end": 128,
      "token_count": 128,
      "user_tag": null,
      "content_tags": [],
      "status": 0  // 初始状态
    },
    ...
  ]
}
```

#### 详细说明

**Stage 1 - 基线切分**（`stage1_baseline.py`）
- **输入**：原始 Markdown 文件
- **处理**：
  - 按照标题层级（H1/H2/H3）和段落进行初步切分
  - 控制每个 chunk 大小在配置的 token 范围内
  - 合并过小的段落，拆分过大的段落
- **输出**：初步 chunks 列表

**Stage 2 - 清洗映射**（`stage2_clean_map.py`）
- **输入**：Stage 1 的 chunks
- **处理**：
  - 调用 LLM 清洗每个 chunk，移除：
    - 导航链接、面包屑
    - 页眉页脚
    - 重复的元信息
  - 构建 Token 映射表：
    - `forward_map`: 原文位置 → 清洗后位置
    - `backward_map`: 清洗后位置 → 原文位置
- **输出**：清洗后的 chunks + 映射表

**Stage 3 - 精细定位**（`stage3_refine_locate.py`）
- **输入**：Stage 2 的 chunks 和映射表
- **处理**：
  - LLM 对每个 chunk 进一步语义切分
  - 生成更细粒度的 mini-chunks
  - 通过映射表将 mini-chunk 位置反向定位到原文
  - 计算精确的 `token_start` 和 `token_end`
- **输出**：最终 JSON 文件（包含所有 chunk 的元数据）

---

### 2. 文档处理触发流程

```
[用户在界面点击"处理"按钮]
      ↓
[前端] POST /api/documents/{filename}/process
      ↓
[后端] FastAPI 接收请求
      ↓
[后端] 创建 BackgroundTask
      ↓
[后端] 返回 202 Accepted（立即返回）
      ↓
[后台] 执行命令：
       uv run main.py ../all-md/{filename} -o ../rag-visualizer/public/output/{name}
      ↓
[后台] 监控处理状态
      ↓
[处理完成] 更新 processing_tasks 状态
      ↓
[前端] 轮询获取状态（每2秒）
      ↓
[前端] 状态变为 "processed" 后自动加载 JSON 数据
```

---

## 前端架构

### 组件层次结构

```
App.vue (根组件)
├── DocumentSelector.vue          # 文档选择器
│   ├── 文档列表（all-md/ 目录）
│   ├── 状态徽章（processed/processing/error）
│   ├── 处理/重试按钮
│   └── 折叠/展开功能
│
├── DocumentPanel.vue             # 原文显示面板
│   ├── Markdown 渲染（marked.js）
│   ├── 图片加载（ObjectURL）
│   └── 高亮定位（点击 chunk 时）
│
└── ChunksPanel.vue               # Chunks 管理面板
    ├── 搜索框
    ├── 统计信息（总数/总tokens/平均tokens）
    │
    ├── ChunkCard.vue × N         # Chunk 卡片（列表视图）
    │   ├── Chunk ID + 颜色标识
    │   ├── Token 范围（start → end）
    │   ├── Token 统计
    │   ├── 标签显示
    │   ├── 内容预览（前500字符）
    │   └── 废弃状态样式（灰色阴影）
    │
    └── ChunkEditor.vue           # 富文本编辑器（编辑视图）
        ├── 顶部栏：
        │   ├── Chunk 元信息
        │   ├── 废弃按钮
        │   ├── 保存按钮
        │   └── 关闭按钮
        ├── 工具栏（TipTap）：
        │   ├── 格式化（粗体/斜体/删除线）
        │   ├── 标题（H1/H2/H3）
        │   ├── 列表（有序/无序）
        │   ├── 代码块
        │   ├── 图片插入
        │   ├── 表格操作
        │   └── 撤销/重做
        ├── 编辑区域（富文本）
        └── 底部栏：
            ├── 上一条/下一条导航
            └── 保存状态 + 位置指示器
```

### 关键组件说明

#### 1. **DocumentSelector.vue**
- **功能**：
  - 显示 `all-md/` 目录下所有 `.md` 文件
  - 实时查询处理状态（通过 API）
  - 点击未处理文档触发后台处理
  - 支持折叠/展开以节省空间
- **状态管理**：
  - `documents`: 文档列表数组
  - `isCollapsed`: 折叠状态
  - `searchQuery`: 搜索过滤
- **关键方法**：
  - `fetchDocuments()`: 从 API 获取文档列表
  - `processDocument(doc)`: 触发处理
  - `pollDocumentStatus(filename)`: 轮询状态

#### 2. **DocumentPanel.vue**
- **功能**：
  - 渲染原始 Markdown 内容
  - 显示图片（通过 ObjectURL）
  - 响应 chunk 点击事件，高亮对应区域
- **数据输入**：
  - `chunks`: 所有 chunks 数据
  - `loadingImages`: 图片加载状态
- **渲染逻辑**：
  - 使用 `marked.parse()` 将 Markdown 转为 HTML
  - 为每个 chunk 添加 `data-chunk-id` 属性
  - 通过 CSS 类 `highlight-section` 实现高亮

#### 3. **ChunksPanel.vue**
- **功能**：
  - 显示所有 chunks（列表视图）
  - 支持搜索过滤（内容/标签）
  - 点击卡片打开编辑器
  - 监听文档切换，自动关闭编辑器
- **状态管理**：
  - `editingChunk`: 当前编辑的 chunk
  - `currentChunkIndex`: 当前 chunk 索引
  - `filteredChunks`: 过滤后的 chunks
- **事件通信**：
  - `@chunk-click`: 通知高亮
  - `@chunk-updated`: 通知数据更新
  - `@navigate`: 处理上一条/下一条

#### 4. **ChunkEditor.vue**
- **功能**：
  - 基于 TipTap 的富文本编辑
  - 支持 Markdown、表格、图片
  - Chunk 状态管理（废弃标记）
  - 上一条/下一条导航
- **TipTap 扩展**：
  - `StarterKit`: 基础编辑功能
  - `Table` + `TableRow/Cell/Header`: 表格支持
  - `Image`: 图片支持（Base64）
  - `Placeholder`: 占位符提示
- **状态管理**：
  - `hasChanges`: 是否有未保存更改
  - `originalContent`: 原始内容（用于对比）
- **关键方法**：
  - `saveAndClose()`: 保存并关闭
  - `markAsDeprecated()`: 标记为废弃（status = -1）
  - `navigatePrev/Next()`: 切换 chunk

---

## 后端架构

### API 端点

#### 1. **GET /api/documents**
- **功能**：获取所有文档列表及状态
- **返回**：
  ```json
  [
    {
      "filename": "example.md",
      "status": "processed",
      "output_path": "./output/example_final_chunks.json",
      "processed_at": "2024-10-06 12:30:00",
      "error": null
    },
    ...
  ]
  ```
- **状态判断逻辑**：
  - 检查 `public/output/{name}_final_chunks.json` 是否存在
  - 检查 `processing_tasks` 中是否有运行中的任务
  - 返回 `processed` / `processing` / `not_processed` / `error`

#### 2. **GET /api/documents/{filename}/status**
- **功能**：查询单个文档处理状态
- **返回**：同上单个文档对象

#### 3. **POST /api/documents/{filename}/process**
- **功能**：触发文档处理
- **流程**：
  1. 检查文件是否存在于 `all-md/`
  2. 创建 `BackgroundTask`
  3. 立即返回 `202 Accepted`
  4. 后台执行：
     ```bash
     uv run main.py ../all-md/{filename} -o ../rag-visualizer/public/output/{name}
     ```
  5. 捕获输出和错误
  6. 更新 `processing_tasks` 状态

#### 4. **DELETE /api/documents/{filename}/output**
- **功能**：删除已生成的输出文件（用于重新处理）
- **操作**：删除 `public/output/{name}_final_chunks.json`

### 后台处理逻辑

```python
async def run_processing(filename: str):
    """后台运行处理任务"""
    try:
        # 标记为处理中
        processing_tasks[filename] = {
            'status': 'processing',
            'start_time': datetime.now().isoformat()
        }

        # 执行命令
        result = subprocess.run(
            ['uv', 'run', 'main.py', input_path, '-o', output_dir],
            capture_output=True,
            text=True,
            cwd=IKN_PLUS_DIR
        )

        # 检查结果
        if result.returncode == 0:
            processing_tasks[filename]['status'] = 'completed'
        else:
            processing_tasks[filename]['status'] = 'error'
            processing_tasks[filename]['error'] = result.stderr

    except Exception as e:
        processing_tasks[filename]['status'] = 'error'
        processing_tasks[filename]['error'] = str(e)
```

---

## 数据流与状态管理

### 数据流向

```
1. 用户交互层
   └─> 点击"处理"按钮
       └─> POST /api/documents/{filename}/process

2. API 层
   └─> 创建后台任务
       └─> 返回 202 Accepted

3. 后台任务层
   └─> 执行 main.py
       └─> Stage 1 → Stage 2 → Stage 3
           └─> 生成 JSON 文件

4. 前端轮询层
   └─> 每 2 秒调用 GET /api/documents
       └─> 检测状态变化

5. 数据加载层
   └─> 状态变为 "processed"
       └─> fetch(output_path)
           └─> 加载 JSON 数据到 processedChunks

6. 渲染层
   └─> processedChunks 更新
       └─> DocumentPanel 和 ChunksPanel 重新渲染
```

### 状态管理

#### 前端状态（App.vue）

```javascript
// 文档级状态
const currentDocument = ref('')          // 当前选中的文档
const isProcessing = ref(false)          // 是否正在处理
const processingFilename = ref('')       // 正在处理的文档名

// Chunk 数据
const processedChunks = ref([])          // 处理后的 chunks 数组
const data = ref(null)                   // 完整的 JSON 数据

// UI 状态
const searchQuery = ref('')              // 搜索关键词
const documentTags = ref([])             // 文档标签（localStorage）
```

#### Chunk 状态字段

每个 chunk 包含以下状态：

```javascript
{
  chunk_id: 0,                   // Chunk ID
  content: "...",                // Chunk 内容（Markdown/HTML）
  token_start: 0,                // Token 起始位置
  token_end: 128,                // Token 结束位置
  token_count: 128,              // Token 总数
  user_tag: null,                // 用户自定义标签
  content_tags: [],              // 内容标签
  status: 0                      // 状态码
}
```

#### Chunk 状态码定义

| 状态码 | 含义       | 说明                     |
|--------|-----------|-------------------------|
| -1     | 废弃       | 标记为无效，不参与向量化   |
| 0      | 初始       | 刚切分完成，未确认        |
| 1      | 已确认     | 用户确认内容正确          |
| 2      | 已向量化   | 已导入向量数据库          |

#### 状态持久化

**当前实现**：
- ❌ **前端内存**：所有修改仅存在于 `processedChunks` 响应式变量
- ❌ **刷新丢失**：页面刷新后，所有修改（状态、内容）丢失

**未来改进**：
- ✅ 添加 `PATCH /api/chunks/{chunk_id}` 接口
- ✅ 保存修改回 JSON 文件或数据库
- ✅ 实现真正的持久化

---

## 安装与运行

### 前置要求

- **Node.js** >= 16
- **Python** >= 3.10
- **uv**（Python 包管理器）
- **OpenAI API Key**（或其他 LLM API）

### 1. 克隆项目

```bash
cd /path/to/rag_preprocessor
```

### 2. 后端安装

```bash
# 进入后端目录
cd hit-rag

# 安装依赖（使用 uv）
uv sync

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填入 API keys
```

**`.env` 文件示例**：
```env
OPENAI_API_KEY=sk-xxxxxxxxxxxxx
OPENAI_BASE_URL=https://api.openai.com/v1
```

### 3. 前端安装

```bash
# 进入前端目录
cd ../rag-visualizer

# 安装依赖
npm install
```

### 4. 启动系统

#### 方式一：分别启动（推荐开发）

**终端 1 - 启动后端**：
```bash
cd hit-rag
uv run uvicorn api_server:app --reload --port 8000
```

**终端 2 - 启动前端**：
```bash
cd rag-visualizer
npm run dev
```

#### 方式二：一键启动

```bash
# 在项目根目录
./start.sh
```

**start.sh 内容**：
```bash
#!/bin/bash
# 清理端口
lsof -ti :8000 | xargs kill -9 2>/dev/null
lsof -ti :5173 | xargs kill -9 2>/dev/null

# 启动后端
cd hit-rag && uv run uvicorn api_server:app --reload --port 8000 &

# 启动前端
cd rag-visualizer && npm run dev &

wait
```

### 5. 访问系统

打开浏览器访问：
- **前端界面**：http://localhost:5173
- **后端 API 文档**：http://localhost:8000/docs

---

## 功能说明

### 1. 文档选择与处理

1. **查看文档列表**：
   - 左侧面板自动显示 `all-md/` 目录下的所有 `.md` 文件
   - 状态徽章颜色：
     - 🟢 绿色：已处理
     - 🔵 蓝色：处理中
     - ⚪ 灰色：未处理
     - 🔴 红色：处理出错

2. **触发处理**：
   - 点击未处理文档的"处理"按钮
   - 系统自动调用后台 API
   - 显示处理中遮罩层（防止重复点击）
   - 每 2 秒轮询状态

3. **查看处理结果**：
   - 处理完成后，自动加载 chunks 数据
   - 中间面板显示原文
   - 右侧面板显示 chunks 列表

### 2. Chunks 浏览与搜索

1. **列表视图**：
   - 双列卡片布局
   - 显示：
     - Chunk ID + 颜色标识
     - Token 范围（start → end）
     - Token 统计（当前 chunk）
     - 用户标签 + 内容标签
     - 内容预览（前 500 字符）

2. **搜索过滤**：
   - 在搜索框输入关键词
   - 自动过滤 chunks（匹配内容/标签）

3. **高亮定位**：
   - 点击 chunk 卡片
   - 左侧原文面板自动高亮对应区域
   - 黄色背景 + 橙色左边框

### 3. Chunk 编辑

1. **打开编辑器**：
   - 点击任意 chunk 卡片
   - 右侧面板切换为编辑器视图

2. **富文本编辑**：
   - **工具栏**：
     - 文本格式：粗体、斜体、删除线
     - 标题：H1、H2、H3
     - 列表：有序列表、无序列表
     - 代码块
     - 插入图片（支持 URL 和 Base64）
     - 表格操作：插入、添加行/列、删除
     - 撤销/重做
   - **编辑区**：所见即所得编辑
   - **快捷键**：ESC 关闭编辑器

3. **导航功能**：
   - 底部"上一条"/"下一条"按钮
   - 快速切换 chunks
   - 位置指示器（当前/总数）

4. **保存与状态**：
   - 顶部"保存"按钮
   - 未保存提示（红色 ● 标识）
   - 保存后更新本地数据（前端内存）

### 4. Chunk 状态管理

1. **标记废弃**：
   - 编辑器顶部"废弃"按钮
   - 确认后将 chunk.status 设为 -1
   - 列表视图中呈现灰色阴影效果

2. **状态说明**：
   - `-1` 废弃：不参与向量化
   - `0` 初始：默认状态
   - `1` 已确认：（未来功能）
   - `2` 已向量化：（未来功能）

### 5. 标签管理（文档级）

1. **添加标签**：
   - 顶部标签输入框
   - 回车添加标签
   - 自动分配颜色

2. **删除标签**：
   - 点击标签上的 × 按钮

3. **查看所有标签**：
   - 点击"更多标签"按钮
   - 弹窗显示所有标签

**注**：标签存储在 `localStorage`，按文档名隔离。

---

## 技术栈

### 前端

| 技术                | 用途                          |
|---------------------|------------------------------|
| **Vue 3**           | 前端框架（Composition API）   |
| **Vite**            | 构建工具与开发服务器           |
| **marked.js**       | Markdown → HTML 渲染         |
| **TipTap**          | 富文本编辑器                  |
| **CSS3**            | 样式与动画                    |

### 后端

| 技术                | 用途                          |
|---------------------|------------------------------|
| **FastAPI**         | Web 框架（异步 API）          |
| **uvicorn**         | ASGI 服务器                   |
| **Pydantic**        | 数据验证                      |
| **subprocess**      | 调用 Python 脚本              |

### 核心引擎

| 技术                | 用途                          |
|---------------------|------------------------------|
| **OpenAI API**      | LLM 调用（清洗、切分）        |
| **tiktoken**        | Token 计数与映射              |
| **Python 3.10+**    | 主编程语言                    |

---

## 常见问题

### 1. 处理任务卡住怎么办？

- 检查后端日志：`hit-rag/rag_preprocessor.log`
- 检查 API Key 是否配置正确
- 查看 LLM API 配额是否用尽

### 2. 前端显示"数据加载失败"？

- 检查 JSON 文件是否存在：`rag-visualizer/public/output/`
- 检查文件权限
- 打开浏览器开发者工具查看网络请求

### 3. 图片无法显示？

- 确认 `config.js` 中 `showImages: true`
- 检查图片路径是否正确
- 查看浏览器控制台是否有 CORS 错误

### 4. 修改的内容刷新后丢失？

- **当前限制**：修改仅存在于前端内存
- **解决方案**：等待后端持久化功能上线，或手动保存到 JSON

---

## 开发计划

- [ ] Chunk 修改持久化（保存到 JSON）
- [ ] 批量状态管理（批量确认/废弃）
- [ ] 导出功能（导出为 Markdown/JSON）
- [ ] 向量化集成（连接向量数据库）
- [ ] 用户认证与权限管理
- [ ] 协作编辑（WebSocket 实时同步）

---

## 许可证

MIT License

---

## 联系方式

如有问题或建议，请联系项目维护者。
