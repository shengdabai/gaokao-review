/**
 * 错题本 API
 * GET /api/mistakes - 获取错题列表
 * POST /api/mistakes - 添加错题
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDatabase, generateId } from '../lib/db';
import { authenticateRequest } from '../lib/auth';
import { sendSuccess, sendError, sendPredefinedError } from '../lib/response';

/**
 * 添加错题请求体类型
 */
interface AddMistakeBody {
  subject: string;
  imageUrl: string;  // Base64 图片或 URL
  analysis: string;
  tags?: string[];
}

/**
 * 错题数据库记录类型
 */
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

/**
 * 有效学科列表
 */
const VALID_SUBJECTS = ['math', 'physics', 'chemistry', 'chinese', 'english', 'politics'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 验证用户认证
  const auth = authenticateRequest(req);
  if (!auth) {
    return sendPredefinedError(res, 'UNAUTHORIZED');
  }

  const db = getDatabase();

  // GET 请求：获取错题列表
  if (req.method === 'GET') {
    try {
      const { subject, tag, page = '1', limit = '20' } = req.query;

      const pageNum = Math.max(1, parseInt(page as string) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 20));
      const offset = (pageNum - 1) * limitNum;

      // 构建查询条件
      let whereClause = 'WHERE user_id = ?';
      const params: any[] = [auth.userId];

      if (subject && VALID_SUBJECTS.includes(subject as string)) {
        whereClause += ' AND subject = ?';
        params.push(subject);
      }

      // 获取总数
      const countResult = db
        .prepare(`SELECT COUNT(*) as total FROM mistakes ${whereClause}`)
        .get(...params) as { total: number };

      // 获取列表
      params.push(limitNum, offset);
      const mistakes = db
        .prepare(`
          SELECT id, subject, image_data, analysis, tags, created_at, updated_at, sync_status
          FROM mistakes
          ${whereClause}
          ORDER BY created_at DESC
          LIMIT ? OFFSET ?
        `)
        .all(...params) as MistakeRecord[];

      // 如果指定了标签筛选，在内存中过滤
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

    } catch (error) {
      console.error('Get mistakes error:', error);
      return sendPredefinedError(res, 'INTERNAL_ERROR');
    }
  }

  // POST 请求：添加错题
  if (req.method === 'POST') {
    try {
      const { subject, imageUrl, analysis, tags = [] } = req.body as AddMistakeBody;

      // 验证参数
      if (!subject || !VALID_SUBJECTS.includes(subject)) {
        return sendError(res, 'INVALID_REQUEST', '无效的学科', 400);
      }

      if (!imageUrl) {
        return sendError(res, 'INVALID_REQUEST', '请提供题目图片', 400);
      }

      if (!analysis) {
        return sendError(res, 'INVALID_REQUEST', '请提供分析内容', 400);
      }

      // 创建新错题
      const mistakeId = generateId();
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO mistakes (id, user_id, subject, image_data, analysis, tags, created_at, updated_at, sync_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'synced')
      `).run(
        mistakeId,
        auth.userId,
        subject,
        imageUrl,
        analysis,
        JSON.stringify(tags),
        now,
        now
      );

      return sendSuccess(res, {
        id: mistakeId,
        createdAt: now,
      }, 201);

    } catch (error) {
      console.error('Add mistake error:', error);
      return sendPredefinedError(res, 'INTERNAL_ERROR');
    }
  }

  return sendPredefinedError(res, 'METHOD_NOT_ALLOWED');
}


