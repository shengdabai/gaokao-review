#!/bin/bash

# 高考冲刺智能复习助手 - 安装脚本
# ======================================

echo "🎓 高考冲刺智能复习助手 - 安装脚本"
echo "========================================"
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 检查 Node.js
echo "📦 检查 Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo -e "${GREEN}✓ Node.js 已安装: $NODE_VERSION${NC}"
else
    echo -e "${RED}✗ Node.js 未安装，请先安装 Node.js 18+${NC}"
    echo "下载地址: https://nodejs.org/"
    exit 1
fi

# 安装主项目依赖
echo ""
echo "📦 安装主项目依赖..."
npm install
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ 主项目依赖安装完成${NC}"
else
    echo -e "${RED}✗ 依赖安装失败${NC}"
    exit 1
fi

# 检查环境变量
echo ""
echo "🔧 检查环境变量配置..."
if [ -f ".env.local" ]; then
    echo -e "${GREEN}✓ .env.local 文件存在${NC}"
else
    echo -e "${YELLOW}⚠ 未找到 .env.local 文件，正在创建模板...${NC}"
    cat > .env.local << EOF
# Gemini API Key - 从 https://aistudio.google.com/ 获取
GEMINI_API_KEY=your_api_key_here

# Get笔记 API Token
GETNOTES_TOKEN=your_token_here

# JWT 签名密钥（可自定义随机字符串）
JWT_SECRET=$(openssl rand -hex 32)
EOF
    echo -e "${YELLOW}请编辑 .env.local 文件，填入你的 API Key${NC}"
fi

# 初始化数据库
echo ""
echo "🗃️ 初始化数据库..."
mkdir -p data
if [ -f "scripts/init-db.js" ]; then
    node scripts/init-db.js
    echo -e "${GREEN}✓ 数据库初始化完成${NC}"
fi

echo ""
echo "========================================"
echo -e "${GREEN}🎉 安装完成！${NC}"
echo ""
echo "下一步操作："
echo "1. 编辑 .env.local 填入你的 API Key"
echo "2. 运行 npm run dev 启动本地开发"
echo "3. 运行 vercel --prod 部署到生产环境"
echo ""
echo "📱 安装移动端 APP："
echo "cd 高考复习-mobile && npm install && eas build --platform android --profile preview"
echo ""

