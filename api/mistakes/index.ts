/**
 * 错题本 API（合并版）
 * GET    /api/mistakes              - 获取错题列表
 * POST   /api/mistakes              - 添加错题
 * GET    /api/mistakes?id=xxx       - 获取单条错题
 * DELETE /api/mistakes?id=xxx       - 删除错题
 * POST   /api/mistakes?action=sync  - 同步错题
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDatabase, generateId } from '../lib/db';
import { authenticateRequest } from '../lib/auth';
import { sendSuccess, sendError, sendPredefinedError } from '../lib/response';
import { handleCors } from '../lib/cors';
import { VALID_SUBJECTS, safeJsonParse } from '../lib/constants';

// 获取错题列表
async function handleGetList(req: VercelRequest, res: VercelResponse, userId: string) {
  const db = getDatabase();
  const { subject, page = '1', limit = '20' } = req.query;

  const pageNum = Math.max(1, parseInt(page as string) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 20));
  const offset = (pageNum - 1) * limitNum;

  const subjectFilter = subject && VALID_SUBJECTS.includes(subject as string) ? subject as string : undefined;

  const mistakes = await db.getMistakes(userId, subjectFilter, limitNum, offset);
  const total = await db.getMistakesCount(userId, subjectFilter);

  return sendSuccess(res, {
    items: mistakes.map(m => ({
      id: m.id,
      subject: m.subject,
      imageUrl: m.image_data,
      analysis: m.analysis,
      tags: safeJsonParse<string[]>(m.tags, []),
      createdAt: m.created_at,
      updatedAt: m.updated_at,
      syncStatus: m.sync_status,
    })),
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  });
}

// 获取单条错题
async function handleGetOne(req: VercelRequest, res: VercelResponse, userId: string, id: string) {
  const db = getDatabase();
  const mistake = await db.getMistakeById(id, userId);

  if (!mistake) {
    return sendPredefinedError(res, 'NOT_FOUND', '错题不存在');
  }

  return sendSuccess(res, {
    id: mistake.id,
    subject: mistake.subject,
    imageUrl: mistake.image_data,
    analysis: mistake.analysis,
    tags: safeJsonParse<string[]>(mistake.tags, []),
    createdAt: mistake.created_at,
    updatedAt: mistake.updated_at,
    syncStatus: mistake.sync_status,
  });
}

// 添加错题
async function handleAdd(req: VercelRequest, res: VercelResponse, userId: string) {
  const db = getDatabase();
  const { subject, imageUrl, analysis, tags: rawTags } = req.body;
  const tags = Array.isArray(rawTags) ? rawTags : [];

  if (!subject || !VALID_SUBJECTS.includes(subject)) {
    return sendError(res, 'INVALID_REQUEST', '无效的学科', 400);
  }
  if (!imageUrl) return sendError(res, 'INVALID_REQUEST', '请提供题目图片', 400);
  if (!analysis) return sendError(res, 'INVALID_REQUEST', '请提供分析内容', 400);

  const mistakeId = generateId();
  const now = new Date().toISOString();

  await db.createMistake(mistakeId, userId, subject, imageUrl, analysis, JSON.stringify(tags));

  return sendSuccess(res, { id: mistakeId, createdAt: now }, 201);
}

// 删除错题
async function handleDelete(req: VercelRequest, res: VercelResponse, userId: string, id: string) {
  const db = getDatabase();
  const mistake = await db.getMistakeById(id, userId);

  if (!mistake) {
    return sendPredefinedError(res, 'NOT_FOUND', '错题不存在');
  }

  await db.deleteMistake(id, userId);
  return sendSuccess(res, { message: '删除成功', id });
}

// 同步错题（简化版）
async function handleSync(req: VercelRequest, res: VercelResponse, userId: string) {
  const db = getDatabase();
  const { lastSyncTime } = req.body;
  const now = new Date().toISOString();

  // 获取所有错题返回给客户端
  const serverMistakes = await db.getMistakes(userId, undefined, 1000, 0);

  return sendSuccess(res, {
    syncTime: now,
    syncResults: [],
    serverMistakes: serverMistakes.map(m => ({
      id: m.id,
      subject: m.subject,
      imageUrl: m.image_data,
      analysis: m.analysis,
      tags: safeJsonParse<string[]>(m.tags, []),
      createdAt: m.created_at,
      updatedAt: m.updated_at,
      syncStatus: m.sync_status,
    })),
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS 处理
  if (handleCors(req.method, res, 'GET, POST, DELETE, OPTIONS')) {
    return;
  }

  try {
    const auth = authenticateRequest(req);
    if (!auth) return sendPredefinedError(res, 'UNAUTHORIZED');

    const { id, action } = req.query;

    // POST /api/mistakes?action=sync
    if (req.method === 'POST' && action === 'sync') {
      return await handleSync(req, res, auth.userId);
    }

    // GET/DELETE /api/mistakes?id=xxx
    if (id && typeof id === 'string') {
      if (req.method === 'GET') return await handleGetOne(req, res, auth.userId, id);
      if (req.method === 'DELETE') return await handleDelete(req, res, auth.userId, id);
    }

    // GET /api/mistakes (list)
    if (req.method === 'GET') return await handleGetList(req, res, auth.userId);

    // POST /api/mistakes (add)
    if (req.method === 'POST') return await handleAdd(req, res, auth.userId);

    return sendPredefinedError(res, 'METHOD_NOT_ALLOWED');
  } catch (error) {
    console.error('Mistakes API error:', error);
    return sendPredefinedError(res, 'INTERNAL_ERROR');
  }
}
