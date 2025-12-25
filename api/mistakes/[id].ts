/**
 * 单条错题操作 API
 * GET /api/mistakes/:id - 获取单条错题
 * DELETE /api/mistakes/:id - 删除错题
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDatabase } from '../lib/db';
import { authenticateRequest } from '../lib/auth';
import { sendSuccess, sendPredefinedError } from '../lib/response';

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 验证用户认证
  const auth = authenticateRequest(req);
  if (!auth) {
    return sendPredefinedError(res, 'UNAUTHORIZED');
  }

  // 获取错题 ID
  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return sendPredefinedError(res, 'INVALID_REQUEST', '无效的错题 ID');
  }

  const db = getDatabase();

  // GET 请求：获取单条错题
  if (req.method === 'GET') {
    try {
      const mistake = db
        .prepare(`
          SELECT id, user_id, subject, image_data, analysis, tags, created_at, updated_at, sync_status
          FROM mistakes
          WHERE id = ? AND user_id = ?
        `)
        .get(id, auth.userId) as MistakeRecord | undefined;

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

    } catch (error) {
      console.error('Get mistake error:', error);
      return sendPredefinedError(res, 'INTERNAL_ERROR');
    }
  }

  // DELETE 请求：删除错题
  if (req.method === 'DELETE') {
    try {
      // 先检查是否存在且属于当前用户
      const mistake = db
        .prepare('SELECT id FROM mistakes WHERE id = ? AND user_id = ?')
        .get(id, auth.userId);

      if (!mistake) {
        return sendPredefinedError(res, 'NOT_FOUND', '错题不存在');
      }

      // 执行删除
      db.prepare('DELETE FROM mistakes WHERE id = ?').run(id);

      return sendSuccess(res, {
        message: '删除成功',
        id,
      });

    } catch (error) {
      console.error('Delete mistake error:', error);
      return sendPredefinedError(res, 'INTERNAL_ERROR');
    }
  }

  return sendPredefinedError(res, 'METHOD_NOT_ALLOWED');
}


