# 高考冲刺智能复习助手 🎓

> 基于 AI 的高考智能复习系统，融合苏格拉底式教学法和历年真题分析

## ✨ 核心功能

| 功能 | 描述 | 状态 |
|------|------|------|
| 🎓 **AI 导师** | 苏格拉底式教学，个性化辅导 | ✅ 完成 |
| 📊 **试题分析** | 基于历年真题分析考点趋势 | ✅ 完成 |
| 🎯 **考点预测** | AI 预测今年可能的重点 | ✅ 完成 |
| 📈 **学习进度** | 跟踪知识点掌握程度 | ✅ 完成 |
| 📷 **AI 拍题** | 拍照上传，AI 解答讲解 | ✅ 完成 |
| 📚 **笔记搜索** | 连接 Get笔记知识库 | ✅ 完成 |
| 📝 **错题本** | 保存分析过的题目 | ✅ 完成 |

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

创建 `.env.local` 文件：

```bash
# Gemini API Key
GEMINI_API_KEY=你的API密钥

# Get笔记 API Token
GETNOTES_TOKEN=你的Token

# JWT 签名密钥
JWT_SECRET=随机生成的密钥
```

### 3. 启动开发服务器

```bash
# 前端开发
npm run dev

# 使用 Vercel CLI 启动（包含 API）
vercel dev
```

### 4. 部署到 Vercel

```bash
vercel --prod
```

## 📱 安卓应用

```bash
cd 高考复习-mobile
npm install

# 开发模式
npx expo start

# 构建 APK
eas build --platform android --profile preview
```

## 📖 使用指南

### 导入高考真题

将 iCloud 中的高考试卷 PDF 导入 Get笔记知识库，详见 [PDF导入指南](./docs/PDF导入指南.md)

### AI 导师使用

1. 选择学科和学习模式（学习/复习/测验）
2. 输入想学习的知识点
3. 开始对话，AI 会采用苏格拉底式教学引导你学习
4. 系统自动记录学习进度

### 试题分析

1. 选择要分析的学科
2. 可选指定具体知识点
3. AI 基于知识库中的历年真题进行分析
4. 获得高频考点、命题趋势、预测重点

## 🛠️ 技术栈

- **前端**: React 19 + Vite + Tailwind CSS
- **后端**: Vercel Serverless Functions
- **数据库**: SQLite
- **AI**: Gemini API
- **知识库**: Get笔记 API
- **移动端**: React Native + Expo

## 📁 项目结构

```
高考复习/
├── api/                    # Serverless API
│   ├── ai/                 # AI 相关 API
│   │   ├── tutor.ts        # AI 导师（苏格拉底式教学）
│   │   ├── predict.ts      # 试题分析预测
│   │   ├── analyze.ts      # 图片分析
│   │   └── ask.ts          # 文本问答
│   ├── auth/               # 用户认证
│   ├── notes/              # 笔记搜索
│   ├── mistakes/           # 错题本
│   ├── progress/           # 学习进度
│   └── lib/                # 工具库
├── components/             # React 组件
│   ├── TutorChat.tsx       # AI 导师聊天
│   ├── PredictAnalysis.tsx # 试题分析
│   ├── StudyProgress.tsx   # 学习进度
│   └── AuthPage.tsx        # 登录注册
├── services/               # API 服务
├── hooks/                  # React Hooks
├── docs/                   # 文档
└── 高考复习-mobile/         # 移动端应用
```

## 🎓 学习方法

本项目采用 [CFP-Study](https://github.com/chenran818/CFP-Study) 的苏格拉底式教学理念：

1. **先问后教** - 先了解学生已知内容
2. **循序渐进** - 基于已有知识逐步深入
3. **验证理解** - 每次讲解后提问验证
4. **个性适配** - 根据回答调整教学风格
5. **追踪进度** - 自动记录学习情况

## 📊 学科覆盖

| 学科 | 知识点数 | 描述 |
|------|---------|------|
| 📐 数学 | 33 | 重点：函数、导数、圆锥曲线 |
| ⚡ 物理 | 20 | 重点：力学、电磁学 |
| 🧪 化学 | 20 | 重点：反应原理、有机化学 |
| 📖 语文 | 12 | 阅读、作文、文言文 |
| 🔤 英语 | 14 | 语法、阅读、写作 |
| ⚖️ 政治 | 13 | 哲学、经济、政治生活 |

## 📝 更新日志

### v2.0.0 (2024-12)
- ✨ 新增 AI 导师（苏格拉底式教学）
- ✨ 新增试题分析与预测功能
- ✨ 新增学习进度跟踪
- 🔧 优化移动端体验

### v1.0.0
- 🎉 初始版本发布
- ✅ AI 拍题讲解
- ✅ Get笔记搜索
- ✅ 错题本功能

## 📄 许可证

MIT License

---

**高考加油！** 🎯
