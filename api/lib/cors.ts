/**
 * 共享 CORS 处理函数
 * 统一设置跨域请求头
 */

import type { VercelResponse } from '@vercel/node';

const ALLOWED_ORIGIN = process.env.CORS_ORIGIN || '*';

/**
 * 设置 CORS 响应头并处理 OPTIONS 预检请求
 * @returns true 表示是 OPTIONS 请求，已处理完毕；false 表示非 OPTIONS，需继续处理
 */
export function handleCors(
  method: string | undefined,
  res: VercelResponse,
  allowedMethods: string = 'GET, POST, OPTIONS'
): boolean {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', allowedMethods);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }

  return false;
}
