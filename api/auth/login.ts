/**
 * 用户登录 API
 * POST /api/auth/login
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDatabase } from '../lib/db';
import { verifyPassword, generateToken } from '../lib/auth';
import { sendSuccess, sendError, sendPredefinedError } from '../lib/response';

/**
 * 登录请求体类型
 */
interface LoginBody {
  username: string;
  password: string;
}

/**
 * 用户数据库记录类型
 */
interface UserRecord {
  id: string;
  username: string;
  password_hash: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 只允许 POST 请求
  if (req.method !== 'POST') {
    return sendPredefinedError(res, 'METHOD_NOT_ALLOWED');
  }

  try {
    const { username, password } = req.body as LoginBody;

    // 验证参数
    if (!username || !password) {
      return sendError(res, 'INVALID_REQUEST', '用户名和密码不能为空', 400);
    }

    const db = getDatabase();

    // 查找用户
    const user = db
      .prepare('SELECT id, username, password_hash FROM users WHERE username = ?')
      .get(username) as UserRecord | undefined;

    if (!user) {
      return sendPredefinedError(res, 'INVALID_CREDENTIALS');
    }

    // 验证密码
    const isValid = await verifyPassword(password, user.password_hash);

    if (!isValid) {
      return sendPredefinedError(res, 'INVALID_CREDENTIALS');
    }

    // 生成 Token
    const token = generateToken({ userId: user.id, username: user.username });

    // 返回成功响应
    return sendSuccess(res, {
      userId: user.id,
      username: user.username,
      token,
    });

  } catch (error) {
    console.error('Login error:', error);
    return sendPredefinedError(res, 'INTERNAL_ERROR');
  }
}


