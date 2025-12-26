/**
 * 知识点笔记 API（合并版）
 * POST /api/notes?action=search  - 搜索知识点
 * GET  /api/notes?action=history - 获取搜索历史
 * DELETE /api/notes?action=history - 清空搜索历史
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { authenticateRequest } from '../lib/auth';
import { getDatabase, generateId } from '../lib/db';
import { sendSuccess, sendError, sendPredefinedError } from '../lib/response';

// API 配置
const GETNOTES_URL = 'https://hook.us2.make.com/628uk9k37rq9v8cffmsw4u2ao7kel6l2';
const GETNOTES_TOKEN = process.env.GETNOTES_TOKEN || '';
const GETNOTES_TOPIC_IDS = ['K0BlyZmn', 'BJ888R8J'];
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const TEXT_MODEL = 'gemini-2.5-flash-preview-05-20';

interface SearchBody {
  query: string;
  subject?: string;
}

const SUBJECT_NAMES: Record<string, string> = {
  math: '数学', physics: '物理', chemistry: '化学',
  chinese: '语文', english: '英语', politics: '政治',
};

// 调用 Get笔记 API
async function callGetNotesAPI(query: string): Promise<any> {
  const response = await fetch(GETNOTES_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GETNOTES_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      question: query,
      topic_ids: GETNOTES_TOPIC_IDS,
      deep_seek: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`Get笔记 API 返回错误: ${response.status}`);
  }

  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { answer: text };
  }
}

// 使用 Gemini AI 生成笔记
async function generateNotesWithAI(query: string, subject?: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: TEXT_MODEL });

  const subjectHint = subject && SUBJECT_NAMES[subject]
    ? `这是关于高中${SUBJECT_NAMES[subject]}的知识点。`
    : '';

  const prompt = `你是一个全能的高考知识库。学生正在搜索关于"${query}"的知识点笔记。
${subjectHint}

请按照以下格式总结这个知识点：

## 【核心概念】
- 用简洁的语言解释这个知识点的定义和基本原理

## 【重点公式/结论】
- 列出相关的重要公式或结论

## 【常见题型】
- 高考中通常怎么考这个知识点

## 【易错点提醒】
- 学生常犯的错误有哪些

使用 Markdown 格式，语言通俗易懂。`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response.text() || '';
}

// 搜索知识点
async function handleSearch(req: VercelRequest, res: VercelResponse, userId: string) {
  const { query, subject } = req.body as SearchBody;

  if (!query || query.trim().length === 0) {
    return sendError(res, 'INVALID_REQUEST', '请输入搜索关键词', 400);
  }

  if (query.length > 200) {
    return sendError(res, 'INVALID_REQUEST', '搜索关键词过长', 400);
  }

  // 保存搜索历史
  const db = getDatabase();
  await db.createSearchHistory(generateId(), userId, query.trim(), subject || null);

  let content = '';
  let source: 'getnotes' | 'ai' = 'getnotes';

  if (GETNOTES_TOKEN) {
    try {
      const result = await callGetNotesAPI(query);
      if (result.answer) content = result.answer;
      else if (result.output) content = result.output;
      else if (result.message) content = result.message;
      else if (typeof result === 'string') content = result;

      if (content && content.length > 50 && !content.toLowerCase().includes('error')) {
        source = 'getnotes';
      } else {
        throw new Error('Get笔记返回内容无效');
      }
    } catch (error) {
      console.warn('Get笔记 API 调用失败，降级到 AI:', error);
      content = '';
    }
  }

  if (!content && GEMINI_API_KEY) {
    try {
      content = await generateNotesWithAI(query, subject);
      source = 'ai';
    } catch (error) {
      console.error('AI 生成笔记失败:', error);
      return sendPredefinedError(res, 'AI_ERROR', '知识点搜索失败，请稍后重试');
    }
  }

  if (!content) {
    return sendPredefinedError(res, 'GETNOTES_ERROR', '暂时无法获取相关知识点');
  }

  return sendSuccess(res, { content, source, query, subject: subject || 'general' });
}

// 获取/清空搜索历史
async function handleHistory(req: VercelRequest, res: VercelResponse, userId: string) {
  const db = getDatabase();

  if (req.method === 'DELETE') {
    await db.clearSearchHistory(userId);
    return sendSuccess(res, { message: '搜索历史已清空' });
  }

  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const history = await db.getSearchHistory(userId, limit);

  // 去重
  const uniqueHistory: any[] = [];
  const seenQueries = new Set<string>();

  for (const record of history) {
    if (!seenQueries.has(record.query)) {
      seenQueries.add(record.query);
      uniqueHistory.push(record);
    }
  }

  return sendSuccess(res, {
    items: uniqueHistory.map(h => ({
      id: h.id,
      query: h.query,
      subject: h.subject,
      createdAt: h.created_at,
    })),
    total: uniqueHistory.length,
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const auth = authenticateRequest(req);
    if (!auth) {
      return sendPredefinedError(res, 'UNAUTHORIZED');
    }

    const action = req.query.action as string;

    if (action === 'search' && req.method === 'POST') {
      return await handleSearch(req, res, auth.userId);
    } else if (action === 'history' && (req.method === 'GET' || req.method === 'DELETE')) {
      return await handleHistory(req, res, auth.userId);
    } else {
      return sendError(res, 'INVALID_REQUEST', '请指定有效的 action 参数', 400);
    }
  } catch (error) {
    console.error('Notes API error:', error);
    return sendPredefinedError(res, 'INTERNAL_ERROR');
  }
}
