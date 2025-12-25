# 高考试卷 PDF 导入指南

> 本指南帮助你将 iCloud 中存储的高考试卷 PDF 导入到 Get笔记知识库，让 AI 能够基于真实历年真题进行分析和预测。

## 📋 准备工作

### 1. 整理 PDF 文件

建议按以下结构整理你的高考试卷：

```
iCloud/高考真题/
├── 数学/
│   ├── 2024全国甲卷数学.pdf
│   ├── 2024全国甲卷数学解析.pdf
│   ├── 2023全国甲卷数学.pdf
│   ├── 2023全国甲卷数学解析.pdf
│   └── ...
├── 物理/
│   ├── 2024全国甲卷物理.pdf
│   └── ...
├── 化学/
├── 语文/
├── 英语/
└── 政治/
```

### 2. PDF 质量要求

- ✅ **文字清晰**：扫描件需保证文字可识别
- ✅ **包含解析**：试题 + 答案解析效果更好
- ✅ **完整年份**：建议收集近 10 年真题
- ✅ **标注来源**：文件名标明年份、卷别

---

## 🚀 导入到 Get笔记

### 方法一：Get笔记 App 导入（推荐）

1. **下载 Get笔记 App**
   - iOS: App Store 搜索 "Get笔记"
   - Android: 官网下载

2. **创建知识库**
   - 打开 App → 点击 "+" → 选择 "新建知识库"
   - 命名为 "高考真题库" 或类似名称

3. **上传 PDF 文件**
   - 进入知识库 → 点击 "上传"
   - 从 iCloud / 文件 App 选择 PDF
   - 支持批量上传多个文件

4. **等待处理**
   - Get笔记会自动解析 PDF 内容
   - 处理时间取决于文件大小
   - 处理完成后即可搜索

5. **获取 Topic ID**
   - 进入知识库设置
   - 复制知识库的 Topic ID
   - 将其配置到项目中

### 方法二：Get笔记 网页版导入

1. 访问 [getnotes.com](https://getnotes.com)
2. 登录账号 → 进入知识库
3. 拖拽 PDF 文件上传
4. 等待处理完成

---

## ⚙️ 配置项目连接知识库

### 1. 获取 API 凭证

在 Get笔记 开发者设置中获取：
- **API Token**: 用于调用 API
- **Topic ID**: 知识库唯一标识

### 2. 更新环境变量

在项目根目录创建或编辑 `.env.local` 文件：

```bash
# Get笔记 API 配置
GETNOTES_TOKEN=你的API_Token
# 如果使用官方 OpenAPI:
# GET_NOTES_API_TOKEN=你的Token

# Topic ID 在 api/notes/search.ts 中配置
```

### 3. 更新 Topic ID

编辑 `api/notes/search.ts` 和 `api/ai/tutor.ts`：

```typescript
// 将此处改为你的知识库 Topic ID
const GETNOTES_TOPIC_IDS = ['你的TopicID'];
```

---

## 📱 在安卓手机上使用

### 方法一：浏览器访问（最简单）

1. 部署项目到 Vercel
2. 手机浏览器访问部署地址
3. 可添加到主屏幕当 App 使用

### 方法二：安装 APK

1. **准备环境**
   ```bash
   cd 高考复习-mobile
   npm install
   ```

2. **构建 APK**
   ```bash
   # 安装 EAS CLI
   npm install -g eas-cli
   
   # 登录 Expo 账号
   eas login
   
   # 构建 APK
   eas build --platform android --profile preview
   ```

3. **安装到手机**
   - 下载生成的 APK 文件
   - 传输到手机
   - 开启"允许安装未知来源应用"
   - 点击 APK 安装

4. **配置 API 地址**
   
   编辑 `高考复习-mobile/constants/api.ts`：
   ```typescript
   export const API_BASE_URL = 'https://你的vercel部署地址/api';
   ```

---

## 🔧 高级配置

### 使用官方 OpenAPI（推荐）

如果你有 Get笔记官方 OpenAPI 权限：

```typescript
// api/notes/search.ts
const GETNOTES_URL = 'https://open-api.biji.com/getnote/openapi/knowledge/search/recall';

// 请求头
headers: {
  'Authorization': `Bearer ${process.env.GET_NOTES_API_TOKEN}`,
  'X-OAuth-Version': '1',
  'Content-Type': 'application/json',
}
```

### 优化 PDF 识别效果

对于数学公式较多的试卷，可以：

1. **预处理 PDF**
   - 使用 Mathpix 识别公式
   - 转换为 Markdown 格式再上传

2. **手动标注**
   - 在 Get笔记中为每份试卷添加标签
   - 标签格式：`年份_学科_卷别`

---

## ❓ 常见问题

### Q: PDF 上传后搜索不到内容？

A: 
1. 检查 PDF 是否处理完成（查看知识库状态）
2. 确认 Topic ID 配置正确
3. 尝试更具体的搜索关键词

### Q: 数学公式识别不准？

A:
1. 使用更高清的 PDF 源文件
2. 考虑使用 Mathpix 预处理
3. 对于复杂公式，手动补充到知识库

### Q: API 调用失败？

A:
1. 检查 Token 是否过期
2. 确认 API 请求限额
3. 查看服务器日志排查错误

---

## 📊 数据结构建议

为了让 AI 更好地分析，建议在上传时按以下方式组织内容：

```
# 2024年全国甲卷数学

## 选择题

### 第1题
【题目】设集合 A = {x | x² - 4 < 0}...
【答案】B
【解析】解不等式 x² - 4 < 0...
【考点】集合运算、不等式
【难度】易

### 第2题
...

## 填空题
...

## 解答题
...
```

---

## 🎯 下一步

完成 PDF 导入后，你可以：

1. **使用 AI 导师** - 针对知识点进行苏格拉底式学习
2. **试题分析** - 分析历年真题出题规律
3. **预测重点** - 基于数据预测今年考点
4. **跟踪进度** - 监控各知识点掌握程度

祝你高考顺利！🎉

