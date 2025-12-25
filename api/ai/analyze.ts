/**
 * AI 图片分析 API
 * POST /api/ai/analyze
 * 
 * 使用 Nano Banana Pro2 (Gemini 3 Pro Image) 分析题目图片
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { authenticateRequest } from '../lib/auth';
import { sendSuccess, sendError, sendPredefinedError } from '../lib/response';

// Gemini API 配置
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const IMAGE_MODEL = 'gemini-2.0-flash-exp'; // Nano Banana Pro2 对应的模型

/**
 * 分析请求体类型
 */
interface AnalyzeBody {
  image: string;  // Base64 图片数据 (data:image/xxx;base64,...)
  subject?: string;  // 可选，用于优化分析
}

/**
 * 提取知识点标签的正则
 */
const TAG_REGEX = /【标签】\s*(.+?)(?:\n|$)/;

/**
 * 从 AI 响应中提取知识点标签
 * @param text - AI 响应文本
 * @returns 知识点标签数组
 */
function extractTags(text: string): string[] {
  const match = text.match(TAG_REGEX);
  if (match && match[1]) {
    return match[1]
      .split(/[,，、]/)
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);
  }
  return [];
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

    const { image, subject } = req.body as AnalyzeBody;

    // 验证图片参数
    if (!image) {
      return sendError(res, 'INVALID_REQUEST', '请上传题目图片', 400);
    }

    // 验证图片格式
    if (!image.startsWith('data:image/')) {
      return sendError(res, 'INVALID_REQUEST', '图片格式无效', 400);
    }

    // 提取 Base64 数据和 MIME 类型
    const matches = image.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!matches) {
      return sendError(res, 'INVALID_REQUEST', '图片数据格式错误', 400);
    }

    const mimeType = matches[1];
    const base64Data = matches[2];

    // 构建 Prompt
    const subjectHint = subject && SUBJECT_NAMES[subject] 
      ? `这可能是一道${SUBJECT_NAMES[subject]}题目。` 
      : '';

    const prompt = `你是一位专业的高考辅导老师，特别擅长帮助基础薄弱的学生。
${subjectHint}

请分析这张图片中的题目：

1. 【科目识别】识别这是哪个学科的题目

2. 【标签】列出涉及的核心知识点（用逗号分隔，例如：三角函数, 诱导公式, 特殊角）

3. 【题目内容】简要描述题目要求

4. 【详细解答】给出分步骤的详细解答过程
   - 每一步都要清晰说明
   - 写出关键的公式和计算过程

5. 【通俗解释】用最简单的语言解释这道题涉及的核心概念
   - 假设学生基础较弱
   - 用生活中的例子类比

6. 【提分技巧】提供一个"秒杀法"或应试技巧
   - 如何快速判断答案
   - 考试时的解题策略

请使用 Markdown 格式输出，结构清晰。`;

    // 调用 Gemini API
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: IMAGE_MODEL });

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType,
          data: base64Data,
        },
      },
      { text: prompt },
    ]);

    const response = await result.response;
    const analysisText = response.text();

    if (!analysisText) {
      return sendPredefinedError(res, 'AI_ERROR', '无法解析图片内容');
    }

    // 提取知识点标签
    const tags = extractTags(analysisText);

    // 尝试从响应中识别学科
    let detectedSubject = subject || 'unknown';
    const subjectPatterns: Record<string, RegExp> = {
      math: /数学|函数|几何|方程|导数|数列/,
      physics: /物理|力学|电磁|运动|能量|电路/,
      chemistry: /化学|反应|元素|离子|有机|无机/,
      chinese: /语文|文言文|古诗|阅读|作文/,
      english: /英语|grammar|vocabulary|reading/i,
      politics: /政治|哲学|经济|法律|辩证法/,
    };

    for (const [subj, pattern] of Object.entries(subjectPatterns)) {
      if (pattern.test(analysisText)) {
        detectedSubject = subj;
        break;
      }
    }

    // 返回分析结果
    return sendSuccess(res, {
      analysis: analysisText,
      tags,
      subject: detectedSubject,
      confidence: tags.length > 0 ? 0.9 : 0.7,
    });

  } catch (error: any) {
    console.error('AI analyze error:', error);

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


