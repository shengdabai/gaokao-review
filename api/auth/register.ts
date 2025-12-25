/**
 * 用户注册 API
 * POST /api/auth/register
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDatabase, generateId } from '../lib/db';
import { hashPassword, generateToken, isValidUsername, isValidPassword } from '../lib/auth';
import { sendSuccess, sendError, sendPredefinedError } from '../lib/response';

/**
 * 注册请求体类型
 */
interface RegisterBody {
  username: string;
  password: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 只允许 POST 请求
  if (req.method !== 'POST') {
    return sendPredefinedError(res, 'METHOD_NOT_ALLOWED');
  }

  try {
    const { username, password } = req.body as RegisterBody;

    // 验证参数
    if (!username || !password) {
      return sendError(res, 'INVALID_REQUEST', '用户名和密码不能为空', 400);
    }

    // 验证用户名格式
    if (!isValidUsername(username)) {
      return sendError(
        res,
        'INVALID_REQUEST',
        '用户名必须是 3-20 个字符，只能包含字母、数字和下划线',
        400
      );
    }

    // 验证密码强度
    if (!isValidPassword(password)) {
      return sendError(res, 'INVALID_REQUEST', '密码至少需要 6 个字符', 400);
    }

    const db = getDatabase();

    // 检查用户名是否已存在
    const existingUser = db
      .prepare('SELECT id FROM users WHERE username = ?')
      .get(username);

    if (existingUser) {
      return sendPredefinedError(res, 'USERNAME_EXISTS');
    }

    // 创建新用户
    const userId = generateId();
    const passwordHash = await hashPassword(password);
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO users (id, username, password_hash, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, username, passwordHash, now, now);

    // 生成 Token
    const token = generateToken({ userId, username });

    // 返回成功响应
    return sendSuccess(res, {
      userId,
      username,
      token,
    }, 201);

  } catch (error) {
    console.error('Register error:', error);
    return sendPredefinedError(res, 'INTERNAL_ERROR');
  }
}


