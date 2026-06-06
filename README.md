# 📚 高考冲刺智能复习助手 🎓

> 用 AI 把"刷题"变成"会学"——苏格拉底式 AI 导师 + 历年真题考点分析 + 拍照解题，一个网页端到手机端的高考复习系统。

<p>
  <img alt="最近提交" src="https://img.shields.io/github/last-commit/shengdabai/gaokao-review">
  <img alt="Star 数" src="https://img.shields.io/github/stars/shengdabai/gaokao-review?style=social">
  <img alt="关注作者" src="https://img.shields.io/github/followers/shengdabai?style=social">
</p>

部署地址：<https://gaokao-fuxi.vercel.app>（生产环境域名，访问可用性以实际部署状态为准）

---

## 为什么做这个

市面上的题库 App 大多在"喂题"，而不是"教会"。这个项目反过来——AI 不直接给答案，而是先问你哪里卡住、引导你自己想明白，再用历年真题告诉你哪些考点真正高频、今年可能考什么。它是一名自由职业中文培训师（6000+ 学员）在一线教学中沉淀出来的复习思路，用 AI 工程化落地的成果。

## 做什么

- **不替你做题，而是带你学会**：AI 导师采用苏格拉底式对话，先问后教、循序渐进、随时验证理解。
- **基于真题，而非凭空预测**：考点分析与重点预测都建立在历年高考真题之上，不是拍脑袋。
- **拍照即问**：题目不会做，拍张照上传，AI 解答并讲解思路。
- **网页 + 手机双端**：浏览器即开即用，也可打包成安卓 App 揣进口袋。

## ✨ 功能特性

| 功能 | 说明 |
|------|------|
| 🎓 AI 导师 | 苏格拉底式对话教学，先问后教、个性化引导，不直接给答案 |
| 📊 试题分析 | 基于历年真题分析考点分布与命题趋势 |
| 🎯 考点预测 | AI 结合真题数据预测今年可能的重点方向 |
| 📷 AI 拍题 | 拍照上传，AI 解答并逐步讲解 |
| 📝 错题本 | 保存分析过的题目，沉淀个人薄弱点 |
| 📚 笔记搜索 | 接入 Get 笔记知识库，检索已导入的真题与笔记 |
| 📈 学习进度 | 跟踪各学科知识点掌握程度 |
| 🔐 用户系统 | 注册登录、JWT 鉴权，进度与错题跨设备保留 |

### 学科覆盖

| 学科 | 知识点数 | 重点方向 |
|------|---------|---------|
| 📐 数学 | 33 | 函数、导数、圆锥曲线 |
| ⚡ 物理 | 20 | 力学、电磁学 |
| 🧪 化学 | 20 | 反应原理、有机化学 |
| 📖 语文 | 12 | 阅读、作文、文言文 |
| 🔤 英语 | 14 | 语法、阅读、写作 |
| ⚖️ 政治 | 13 | 哲学、经济、政治生活 |

## 🧱 技术栈

- **前端**：React 19 + TypeScript + Vite + Tailwind CSS + Lucide 图标
- **后端**：Vercel Serverless Functions（Node.js 20.x）
- **数据库**：PostgreSQL（Vercel Postgres / Neon，基于 `pg`）
- **鉴权**：JWT + bcryptjs 密码哈希
- **AI**：Google Gemini（`@google/genai` / `@google/generative-ai`），用于图片识题与自然语言教学
- **知识库**：Get 笔记 API
- **移动端**：React Native + Expo

## 🚀 快速开始

### 环境要求

- Node.js 20.x
- npm
- Vercel 账号（部署用）
- 开通计费的 Google Gemini API Key（AI 功能用）

### 1. 克隆与安装

```bash
git clone https://github.com/shengdabai/gaokao-review.git
cd gaokao-review
npm install
```

### 2. 配置环境变量

在项目根目录创建 `.env.local`（占位符请替换为你自己的值，切勿提交真实密钥）：

```bash
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
GETNOTES_TOKEN=YOUR_GETNOTES_TOKEN
JWT_SECRET=YOUR_RANDOM_SECRET
POSTGRES_URL=YOUR_POSTGRES_CONNECTION_URL
```

### 3. 启动开发服务器

```bash
# 仅前端
npm run dev

# 含 API（需 Vercel CLI）
npm run api:dev
```

### 4. 初始化数据库

```bash
npm run db:init
```

### 5. 部署到生产环境

```bash
vercel --prod
```

### 移动端（可选）

```bash
cd 高考复习-mobile
npm install
npx expo start                                   # 开发模式
eas build --platform android --profile preview   # 构建安卓 APK
```

## 📖 使用说明

1. **导入真题**：把历年高考试卷 PDF 导入 Get 笔记知识库，AI 分析即以此为依据（详见 `docs/` 内的导入说明）。
2. **AI 导师**：选学科与模式（学习 / 复习 / 测验）→ 输入想学的知识点 → 对话学习，系统自动记录进度。
3. **试题分析**：选学科（可指定具体知识点）→ AI 基于真题给出高频考点、命题趋势与预测重点。
4. **拍题**：拍照上传不会的题，AI 解答并讲解。
5. **错题本**：把分析过的题一键保存，长期沉淀薄弱环节。

## 🗺️ 项目状态

个人实验性项目，由一线教学需求驱动，仍在持续迭代中。核心功能（AI 导师、试题分析、拍题、错题本、进度跟踪、用户系统）已实现并部署；AI 输出质量依赖所配置的 Gemini Key 与导入的真题数据，使用体验会随知识库完善而提升。欢迎试用、提 Issue、给建议。

## 🤝 关于与连接

作者 **Tony（盛）** 是一名自由职业中文培训师，累计教过 6000+ 学员，专注用 AI 打造中文教学与备考工具——把课堂里反复验证有效的方法，做成人人可用的产品。

如果这个项目对你有帮助，欢迎 **⭐ Star** 一下，也欢迎关注 [@shengdabai](https://github.com/shengdabai) 看后续更新。

相关项目：

- [gaokao-600](https://github.com/shengdabai/gaokao-600) — 高考相关复习项目
- [gaokao-study-materials](https://github.com/shengdabai/gaokao-study-materials) — 高考备考学习资料
- [college-major-selector](https://github.com/shengdabai/college-major-selector) — 高考志愿 / 专业选择辅助工具

## 📄 许可证

暂无开源协议。

---

**高考加油！** 🎯
