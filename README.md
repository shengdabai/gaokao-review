# Gaokao Review - AI-Powered Exam Preparation Platform

> An AI-powered exam preparation system integrating Socratic teaching methods and analysis of past exam papers

# 高考冲刺智能复习助手 🎓

> 基于 AI 的高考智能复习系统，融合苏格拉底式教学法和历年真题分析

---

## Features

| Feature | Description | Status |
|--------|-------------|---------|
| 🎓 **AI Tutor** | Socratic teaching, personalized guidance | ✅ Complete |
| 📊 **Question Analysis** | Analysis of exam trends based on past papers | ✅ Complete |
| 🎯 **Topic Prediction** | AI predicts key focus areas for this year | ✅ Complete |
| 📈 **Study Progress** | Track knowledge mastery progress | ✅ Complete |
| 📷 **AI Photo Solver** | Upload photos, AI solves and explains | ✅ Complete |
| 📚 **Notes Search** | Connect to GetNotes knowledge base | ✅ Complete |
| 📝 **Mistake Notebook** | Save analyzed questions | ✅ Complete |

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

## 🚀 Getting Started

### Prerequisites
- Node.js 20.x
- npm or yarn
- Vercel account (for deployment)
- Google API Key with billing enabled (for AI features)

### Installation

1. Clone the repository
```bash
git clone https://github.com/shengdabai/gaokao-review.git
cd gaokao-review
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
```bash
# Create .env.local file
echo "GEMINI_API_KEY=your_api_key" > .env.local
echo "GETNOTES_TOKEN=your_token" >> .env.local
echo "JWT_SECRET=your_random_secret" >> .env.local
```

4. Run development server
```bash
# Frontend only
npm run dev

# With Vercel CLI (includes API)
vercel dev
```

5. Deploy to production
```bash
vercel --prod
```

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

## 📱 Mobile App

```bash
cd gaokao-review-mobile
npm install

# Development mode
npx expo start

# Build APK
eas build --platform android --profile preview
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

## 📖 Usage Guide

### Importing Gaokao Past Papers

Import PDF files of past Gaokao papers from iCloud to GetNotes knowledge base. See [PDF Import Guide](./docs/PDF导入指南.md) for details.

### AI Tutor Usage

1. Select subject and learning mode (Study/Review/Quiz)
2. Enter the topic you want to learn
3. Start conversation - AI will use Socratic method to guide your learning
4. System automatically records learning progress

### Question Analysis

1. Select subject for analysis
2. Optionally specify particular knowledge points
3. AI analyzes based on past papers in knowledge base
4. Get high-frequency topics, question trends, and predicted focus areas

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

## 🛠️ Tech Stack

### Frontend
- **React 19.2.1** - UI library with modern features
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool and development server
- **Tailwind CSS** - Utility-first CSS framework
- **Lucide React** - Beautiful icon library

### Backend
- **Vercel** - Serverless platform deployment
- **Node.js 20.x** - Runtime environment
- **PostgreSQL** - Database for user data and content
- **JWT** - Authentication and authorization
- **bcryptjs** - Password hashing

### AI/ML
- **Google Gemini AI** - Advanced AI models for image analysis and natural language processing
- **Google Generative AI** - Content generation and analysis

## 🛠️ 技术栈

- **前端**: React 19 + Vite + Tailwind CSS
- **后端**: Vercel Serverless Functions
- **数据库**: SQLite
- **AI**: Gemini API
- **知识库**: Get笔记 API
- **移动端**: React Native + Expo

## 📁 Project Structure

```
gaokao-review/
├── src/
│   ├── components/          # React components
│   │   ├── AuthPage.tsx    # Authentication page
│   │   ├── TutorChat.tsx   # AI chat interface
│   │   ├── PredictAnalysis.tsx # Performance analysis
│   │   ├── StudyProgress.tsx # Progress tracking
│   │   └── ...
│   ├── hooks/              # Custom React hooks
│   │   └── useAuth.ts      # Authentication hook
│   ├── services/           # API services
│   │   └── api.ts          # API client
│   ├── constants/          # Constants and configuration
│   │   └── subjects.ts     # Subject definitions
│   └── api/                # Backend API routes
│       ├── auth/           # Authentication endpoints
│       ├── ai/             # AI analysis endpoints
│       ├── notes/          # Notes search endpoints
│       ├── mistakes/       # Mistake tracking endpoints
│       └── progress/       # Progress tracking endpoints
├── public/                 # Static assets
├── scripts/                # Build and utility scripts
└── dist/                   # Build output
```

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

## 🎓 Learning Methodology

This project adopts the Socratic teaching methodology from [CFP-Study](https://github.com/chenran818/CFP-Study):

1. **Ask before teaching** - Understand what students already know
2. **Progressive learning** - Build on existing knowledge step by step
3. **Verify understanding** - Ask questions after each explanation
4. **Personalized adaptation** - Adjust teaching style based on responses
5. **Progress tracking** - Automatically record learning progress

## 🎓 学习方法

本项目采用 [CFP-Study](https://github.com/chenran818/CFP-Study) 的苏格拉底式教学理念：

1. **先问后教** - 先了解学生已知内容
2. **循序渐进** - 基于已有知识逐步深入
3. **验证理解** - 每次讲解后提问验证
4. **个性适配** - 根据回答调整教学风格
5. **追踪进度** - 自动记录学习情况

## 📊 Subject Coverage

| Subject | Topics | Description |
|---------|--------|-------------|
| 📐 Math | 33 | Focus: Functions, Calculus, Conic Sections |
| ⚡ Physics | 20 | Focus: Mechanics, Electromagnetism |
| 🧪 Chemistry | 20 | Focus: Reaction Principles, Organic Chemistry |
| 📖 Chinese | 12 | Reading, Composition, Classical Chinese |
| 🔤 English | 14 | Grammar, Reading, Writing |
| ⚖️ Politics | 13 | Philosophy, Economics, Political Life |

## 📊 学科覆盖

| 学科 | 知识点数 | 描述 |
|------|---------|------|
| 📐 数学 | 33 | 重点：函数、导数、圆锥曲线 |
| ⚡ 物理 | 20 | 重点：力学、电磁学 |
| 🧪 化学 | 20 | 重点：反应原理、有机化学 |
| 📖 语文 | 12 | 阅读、作文、文言文 |
| 🔤 英语 | 14 | 语法、阅读、写作 |
| ⚖️ 政治 | 13 | 哲学、经济、政治生活 |

## 📝 Changelog

### v2.0.0 (2024-12)
- ✨ Added AI Tutor (Socratic teaching method)
- ✨ Added question analysis and prediction features
- ✨ Added study progress tracking
- 🔧 Optimized mobile experience

### v1.0.0
- 🎉 Initial release
- ✅ AI photo-based question solving
- ✅ GetNotes search integration
- ✅ Mistake notebook functionality

## 📄 License

MIT License

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 许可证

MIT License

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

**高考加油！** 🎯
# Deploy Fri Dec 26 14:00:53 CST 2025
# Deploy Fri Dec 26 14:00:53 CST 2025
