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

interface MistakeRecord {
  id: string;
  user_id: string;
  subject: string;
  image_data: string;
  analysis: string;
  tags: string;
  created_at: string;
  updated_at: string;
  sync_status: string;
}

const VALID_SUBJECTS = ['math', 'physics', 'chemistry', 'chinese', 'english', 'politics'];

// 获取错题列表
function handleGetList(req: VercelRequest, res: VercelResponse, userId: string) {
  const db = getDatabase();
  const { subject, tag, page = '1', limit = '20' } = req.query;

  const pageNum = Math.max(1, parseInt(page as string) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 20));
  const offset = (pageNum - 1) * limitNum;

  let whereClause = 'WHERE user_id = ?';
  const params: any[] = [userId];

  if (subject && VALID_SUBJECTS.includes(subject as string)) {
    whereClause += ' AND subject = ?';
    params.push(subject);
  }

  const countResult = db
    .prepare(`SELECT COUNT(*) as total FROM mistakes ${whereClause}`)
    .get(...params) as { total: number };

  params.push(limitNum, offset);
  const mistakes = db
    .prepare(`
      SELECT id, subject, image_data, analysis, tags, created_at, updated_at, sync_status
      FROM mistakes ${whereClause}
      ORDER BY created_at DESC LIMIT ? OFFSET ?
    `)
    .all(...params) as MistakeRecord[];

  let filteredMistakes = mistakes;
  if (tag) {
    filteredMistakes = mistakes.filter(m => {
      const tags = JSON.parse(m.tags || '[]');
      return tags.includes(tag);
    });
  }

  return sendSuccess(res, {
    items: filteredMistakes.map(m => ({
      id: m.id,
      subject: m.subject,
      imageUrl: m.image_data,
      analysis: m.analysis,
      tags: JSON.parse(m.tags || '[]'),
      createdAt: m.created_at,
      updatedAt: m.updated_at,
      syncStatus: m.sync_status,
    })),
    pagination: {
      page: pageNum,
      limit: limitNum,
      total: countResult.total,
      totalPages: Math.ceil(countResult.total / limitNum),
    },
  });
}

// 获取单条错题
function handleGetOne(req: VercelRequest, res: VercelResponse, userId: string, id: string) {
  const db = getDatabase();
  const mistake = db
    .prepare(`SELECT * FROM mistakes WHERE id = ? AND user_id = ?`)
    .get(id, userId) as MistakeRecord | undefined;

  if (!mistake) {
    return sendPredefinedError(res, 'NOT_FOUND', '错题不存在');
  }

  return sendSuccess(res, {
    id: mistake.id,
    subject: mistake.subject,
    imageUrl: mistake.image_data,
    analysis: mistake.analysis,
    tags: JSON.parse(mistake.tags || '[]'),
    createdAt: mistake.created_at,
    updatedAt: mistake.updated_at,
    syncStatus: mistake.sync_status,
  });
}

// 添加错题
function handleAdd(req: VercelRequest, res: VercelResponse, userId: string) {
  const db = getDatabase();
  const { subject, imageUrl, analysis, tags = [] } = req.body;

  if (!subject || !VALID_SUBJECTS.includes(subject)) {
    return sendError(res, 'INVALID_REQUEST', '无效的学科', 400);
  }
  if (!imageUrl) return sendError(res, 'INVALID_REQUEST', '请提供题目图片', 400);
  if (!analysis) return sendError(res, 'INVALID_REQUEST', '请提供分析内容', 400);

  const mistakeId = generateId();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO mistakes (id, user_id, subject, image_data, analysis, tags, created_at, updated_at, sync_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'synced')
  `).run(mistakeId, userId, subject, imageUrl, analysis, JSON.stringify(tags), now, now);

  return sendSuccess(res, { id: mistakeId, createdAt: now }, 201);
}

// 删除错题
function handleDelete(req: VercelRequest, res: VercelResponse, userId: string, id: string) {
  const db = getDatabase();
  const mistake = db.prepare('SELECT id FROM mistakes WHERE id = ? AND user_id = ?').get(id, userId);

  if (!mistake) {
    return sendPredefinedError(res, 'NOT_FOUND', '错题不存在');
  }

  db.prepare('DELETE FROM mistakes WHERE id = ?').run(id);
  return sendSuccess(res, { message: '删除成功', id });
}

// 同步错题
function handleSync(req: VercelRequest, res: VercelResponse, userId: string) {
  const db = getDatabase();
  const { lastSyncTime, localMistakes = [] } = req.body;
  const now = new Date().toISOString();

  const syncResults: { id: string; status: string }[] = [];

  for (const local of localMistakes) {
    if (!local.id || !VALID_SUBJECTS.includes(local.subject)) continue;

    const existing = db
      .prepare('SELECT id, updated_at FROM mistakes WHERE id = ? AND user_id = ?')
      .get(local.id, userId) as { id: string; updated_at: string } | undefined;

    if (existing) {
      const serverTime = new Date(existing.updated_at).getTime();
      const localTime = new Date(local.updatedAt).getTime();

      if (localTime > serverTime) {
        db.prepare(`
          UPDATE mistakes SET subject = ?, image_data = ?, analysis = ?, tags = ?, updated_at = ?, sync_status = 'synced'
          WHERE id = ? AND user_id = ?
        `).run(local.subject, local.imageUrl, local.analysis, JSON.stringify(local.tags || []), now, local.id, userId);
        syncResults.push({ id: local.id, status: 'updated' });
      } else if (localTime < serverTime) {
        syncResults.push({ id: local.id, status: 'conflict' });
      }
    } else {
      db.prepare(`
        INSERT INTO mistakes (id, user_id, subject, image_data, analysis, tags, created_at, updated_at, sync_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'synced')
      `).run(local.id, userId, local.subject, local.imageUrl, local.analysis, JSON.stringify(local.tags || []), local.createdAt || now, now);
      syncResults.push({ id: local.id, status: 'created' });
    }
  }

  let serverMistakes: MistakeRecord[] = [];
  if (lastSyncTime) {
    serverMistakes = db.prepare(`SELECT * FROM mistakes WHERE user_id = ? AND updated_at > ? ORDER BY updated_at DESC`).all(userId, lastSyncTime) as MistakeRecord[];
  } else {
    serverMistakes = db.prepare(`SELECT * FROM mistakes WHERE user_id = ? ORDER BY updated_at DESC`).all(userId) as MistakeRecord[];
  }

  return sendSuccess(res, {
    syncTime: now,
    syncResults,
    serverMistakes: serverMistakes.map(m => ({
      id: m.id, subject: m.subject, imageUrl: m.image_data, analysis: m.analysis,
      tags: JSON.parse(m.tags || '[]'), createdAt: m.created_at, updatedAt: m.updated_at, syncStatus: m.sync_status,
    })),
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const auth = authenticateRequest(req);
    if (!auth) return sendPredefinedError(res, 'UNAUTHORIZED');

    const { id, action } = req.query;

    // POST /api/mistakes?action=sync
    if (req.method === 'POST' && action === 'sync') {
      return handleSync(req, res, auth.userId);
    }

    // GET/DELETE /api/mistakes?id=xxx
    if (id && typeof id === 'string') {
      if (req.method === 'GET') return handleGetOne(req, res, auth.userId, id);
      if (req.method === 'DELETE') return handleDelete(req, res, auth.userId, id);
    }

    // GET /api/mistakes (list)
    if (req.method === 'GET') return handleGetList(req, res, auth.userId);

    // POST /api/mistakes (add)
    if (req.method === 'POST') return handleAdd(req, res, auth.userId);

    return sendPredefinedError(res, 'METHOD_NOT_ALLOWED');
  } catch (error) {
    console.error('Mistakes API error:', error);
    return sendPredefinedError(res, 'INTERNAL_ERROR');
  }
}
