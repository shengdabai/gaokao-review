/**
 * AI 文本问答 API
 * POST /api/ai/ask
 * 
 * 使用 Gemini API 回答学习问题
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { authenticateRequest } from '../lib/auth';
import { sendSuccess, sendError, sendPredefinedError } from '../lib/response';

// Gemini API 配置
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const TEXT_MODEL = 'gemini-2.5-flash-preview-05-20'; // 文本生成模型

/**
 * 问答请求体类型
 */
interface AskBody {
  question: string;
  subject?: string;
  context?: string;  // 可选的上下文信息
}

/**
 * 获取学科名称映射
 */
const SUBJECT_NAMES: Record<string, string> = {
  math: '数学',
  physics: '物理',
  chemistry: '化学',
  chinese: '语文',
  english: '英语',
  politics: '政治',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 只允许 POST 请求
  if (req.method !== 'POST') {
    return sendPredefinedError(res, 'METHOD_NOT_ALLOWED');
  }

  // 验证 API Key
  if (!GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY not configured');
    return sendPredefinedError(res, 'INTERNAL_ERROR', 'AI 服务未配置');
  }

  try {
    // 验证用户认证
    const auth = authenticateRequest(req);
    if (!auth) {
      return sendPredefinedError(res, 'UNAUTHORIZED');
    }

    const { question, subject, context } = req.body as AskBody;

    // 验证问题参数
    if (!question || question.trim().length === 0) {
      return sendError(res, 'INVALID_REQUEST', '请输入问题', 400);
    }

    // 限制问题长度
    if (question.length > 2000) {
      return sendError(res, 'INVALID_REQUEST', '问题内容过长，请精简后重试', 400);
    }

    // 构建 Prompt
    const subjectHint = subject && SUBJECT_NAMES[subject]
      ? `学生正在学习${SUBJECT_NAMES[subject]}。`
      : '';

    const contextHint = context
      ? `\n\n相关背景信息：\n${context}`
      : '';

    const prompt = `你是一位专业的高考辅导老师，特别擅长帮助基础薄弱的学生快速理解知识点。
${subjectHint}${contextHint}

学生的问题是：${question}

请按照以下格式回答：

1. **核心概念**
   - 用最简单的语言解释相关概念
   - 适合基础薄弱的学生理解

2. **详细解答**
   - 针对学生的具体问题给出详细解答
   - 如果涉及公式，请写出并解释

3. **举例说明**
   - 用一个具体的例子帮助理解
   - 最好是生活中常见的类比

4. **高考提示**
   - 这个知识点在高考中通常怎么考
   - 有什么解题技巧

请使用 Markdown 格式，语言通俗易懂。`;

    // 调用 Gemini API
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: TEXT_MODEL });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const answerText = response.text();

    if (!answerText) {
      return sendPredefinedError(res, 'AI_ERROR', '生成回答失败');
    }

    // 返回回答
    return sendSuccess(res, {
      answer: answerText,
      question,
      subject: subject || 'general',
    });

  } catch (error: any) {
    console.error('AI ask error:', error);

    // 处理特定错误
    if (error.message?.includes('API key')) {
      return sendPredefinedError(res, 'AI_ERROR', 'API Key 无效或已过期');
    }

    if (error.message?.includes('quota') || error.message?.includes('rate')) {
      return sendPredefinedError(res, 'AI_ERROR', 'AI 服务请求过于频繁，请稍后重试');
    }

    return sendPredefinedError(res, 'AI_ERROR');
  }
}


