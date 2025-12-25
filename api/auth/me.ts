/**
 * 获取当前用户信息 API
 * GET /api/auth/me
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDatabase } from '../lib/db';
import { authenticateRequest } from '../lib/auth';
import { sendSuccess, sendPredefinedError } from '../lib/response';

/**
 * 用户数据库记录类型
 */
interface UserRecord {
  id: string;
  username: string;
  created_at: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 只允许 GET 请求
  if (req.method !== 'GET') {
    return sendPredefinedError(res, 'METHOD_NOT_ALLOWED');
  }

  try {
    // 验证 Token
    const auth = authenticateRequest(req);
    if (!auth) {
      return sendPredefinedError(res, 'UNAUTHORIZED');
    }

    const db = getDatabase();

    // 获取用户信息
    const user = db
      .prepare('SELECT id, username, created_at FROM users WHERE id = ?')
      .get(auth.userId) as UserRecord | undefined;

    if (!user) {
      return sendPredefinedError(res, 'NOT_FOUND', '用户不存在');
    }

    // 获取错题统计
    const mistakeStats = db
      .prepare(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN subject = 'math' THEN 1 END) as math,
          COUNT(CASE WHEN subject = 'physics' THEN 1 END) as physics,
          COUNT(CASE WHEN subject = 'chemistry' THEN 1 END) as chemistry,
          COUNT(CASE WHEN subject = 'chinese' THEN 1 END) as chinese,
          COUNT(CASE WHEN subject = 'english' THEN 1 END) as english,
          COUNT(CASE WHEN subject = 'politics' THEN 1 END) as politics
        FROM mistakes WHERE user_id = ?
      `)
      .get(auth.userId) as any;

    // 返回用户信息
    return sendSuccess(res, {
      userId: user.id,
      username: user.username,
      createdAt: user.created_at,
      stats: {
        totalMistakes: mistakeStats.total,
        bySubject: {
          math: mistakeStats.math,
          physics: mistakeStats.physics,
          chemistry: mistakeStats.chemistry,
          chinese: mistakeStats.chinese,
          english: mistakeStats.english,
          politics: mistakeStats.politics,
        },
      },
    });

  } catch (error) {
    console.error('Get user error:', error);
    return sendPredefinedError(res, 'INTERNAL_ERROR');
  }
}


