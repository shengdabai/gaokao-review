/**
 * 搜索历史 API
 * GET /api/notes/history
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDatabase } from '../lib/db';
import { authenticateRequest } from '../lib/auth';
import { sendSuccess, sendPredefinedError } from '../lib/response';

/**
 * 搜索历史记录类型
 */
interface HistoryRecord {
  id: string;
  query: string;
  subject: string | null;
  created_at: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 只允许 GET 和 DELETE 请求
  if (req.method !== 'GET' && req.method !== 'DELETE') {
    return sendPredefinedError(res, 'METHOD_NOT_ALLOWED');
  }

  try {
    // 验证用户认证
    const auth = authenticateRequest(req);
    if (!auth) {
      return sendPredefinedError(res, 'UNAUTHORIZED');
    }

    const db = getDatabase();

    // DELETE 请求：清空搜索历史
    if (req.method === 'DELETE') {
      db.prepare('DELETE FROM search_history WHERE user_id = ?').run(auth.userId);
      return sendSuccess(res, { message: '搜索历史已清空' });
    }

    // GET 请求：获取搜索历史
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

    const history = db
      .prepare(`
        SELECT id, query, subject, created_at
        FROM search_history
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      `)
      .all(auth.userId, limit) as HistoryRecord[];

    // 去重（按 query 去重，保留最新的）
    const uniqueHistory: HistoryRecord[] = [];
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

  } catch (error) {
    console.error('Get history error:', error);
    return sendPredefinedError(res, 'INTERNAL_ERROR');
  }
}


