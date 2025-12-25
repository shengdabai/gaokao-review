# 高考冲刺助手 - Android 版

专为高三学子打造的智能备考助手 Android 应用。

## 功能特点

- 📷 **AI 拍题分析** - 拍照或上传题目图片，AI 智能解答
- 📚 **知识点搜索** - 搜索高考知识点，获取专业笔记
- 📝 **错题本** - 保存分析过的题目，支持云同步
- 🔄 **离线支持** - 本地缓存，无网络也能查看错题

## 技术栈

- React Native + Expo
- Expo Router (文件路由)
- Expo SQLite (离线存储)
- Expo SecureStore (安全存储)
- Expo Camera/ImagePicker (相机/相册)

## 开发环境准备

### 前置条件

- Node.js 18+
- npm 或 yarn
- Android Studio (用于模拟器)
- Expo Go App (用于真机测试)

### 安装依赖

```bash
cd 高考复习-mobile
npm install
```

### 启动开发服务器

```bash
npm start
# 或
npx expo start
```

然后：
- 按 `a` 在 Android 模拟器中打开
- 或用手机上的 Expo Go 扫描二维码

## 打包 APK

### 1. 安装 EAS CLI

```bash
npm install -g eas-cli
```

### 2. 登录 Expo 账号

```bash
eas login
```

### 3. 配置项目

```bash
eas build:configure
```

### 4. 打包 APK

```bash
npm run build:android
# 或
eas build --platform android --profile preview
```

打包完成后会提供下载链接，下载 APK 并传输到手机安装。

## 配置说明

### API 地址配置

编辑 `constants/api.ts`：

```typescript
// 开发环境
export const API_BASE_URL = __DEV__ 
  ? 'http://10.0.2.2:3000/api'  // Android 模拟器
  : 'https://your-vercel-app.vercel.app/api';  // 生产环境
```

### 真机开发时

如果使用真机测试，需要将 API 地址改为电脑的局域网 IP：

```typescript
export const API_BASE_URL = __DEV__ 
  ? 'http://192.168.x.x:3000/api'  // 你的电脑 IP
  : 'https://your-vercel-app.vercel.app/api';
```

## 项目结构

```
高考复习-mobile/
├── app/                    # 页面 (Expo Router)
│   ├── (auth)/            # 认证相关页面
│   │   └── login.tsx
│   ├── (tabs)/            # 主要标签页
│   │   ├── _layout.tsx
│   │   ├── ai.tsx         # AI 拍题
│   │   ├── notes.tsx      # 笔记搜索
│   │   ├── mistakes.tsx   # 错题本
│   │   └── profile.tsx    # 个人中心
│   └── _layout.tsx        # 根布局
├── constants/             # 常量配置
│   └── api.ts
├── services/              # 服务模块
│   ├── api.ts             # API 调用
│   └── storage.ts         # 本地存储
├── assets/                # 静态资源
├── app.json              # Expo 配置
├── package.json
└── tsconfig.json
```

## 注意事项

1. **个人使用**: 此应用仅用于个人手机，无需上架应用商店
2. **安装权限**: 安装前需在手机设置中允许"安装未知来源应用"
3. **网络连接**: 首次使用需要网络连接以登录和同步数据
4. **存储空间**: 错题图片会占用一定存储空间

## 许可证

MIT

