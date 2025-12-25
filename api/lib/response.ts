/**
 * API 响应工具模块
 * 提供统一的响应格式
 */

import type { VercelResponse } from '@vercel/node';

/**
 * 成功响应数据结构
 */
export interface SuccessResponse<T = any> {
  success: true;
  data: T;
}

/**
 * 错误响应数据结构
 */
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

/**
 * 发送成功响应
 * @param res - Vercel 响应对象
 * @param data - 响应数据
 * @param status - HTTP 状态码，默认 200
 */
export function sendSuccess<T>(res: VercelResponse, data: T, status: number = 200): void {
  res.status(status).json({
    success: true,
    data,
  } as SuccessResponse<T>);
}

/**
 * 发送错误响应
 * @param res - Vercel 响应对象
 * @param code - 错误码
 * @param message - 错误消息
 * @param status - HTTP 状态码，默认 400
 */
export function sendError(
  res: VercelResponse,
  code: string,
  message: string,
  status: number = 400
): void {
  res.status(status).json({
    success: false,
    error: {
      code,
      message,
    },
  } as ErrorResponse);
}

/**
 * 预定义错误码
 */
export const ErrorCodes = {
  // 请求错误 (4xx)
  INVALID_REQUEST: { code: 'INVALID_REQUEST', message: '请求参数格式错误', status: 400 },
  USERNAME_EXISTS: { code: 'USERNAME_EXISTS', message: '用户名已存在', status: 400 },
  INVALID_CREDENTIALS: { code: 'INVALID_CREDENTIALS', message: '用户名或密码错误', status: 401 },
  UNAUTHORIZED: { code: 'UNAUTHORIZED', message: '未登录或 Token 已过期', status: 401 },
  FORBIDDEN: { code: 'FORBIDDEN', message: '无权访问该资源', status: 403 },
  NOT_FOUND: { code: 'NOT_FOUND', message: '资源不存在', status: 404 },
  METHOD_NOT_ALLOWED: { code: 'METHOD_NOT_ALLOWED', message: '不支持该请求方法', status: 405 },

  // 服务器错误 (5xx)
  AI_ERROR: { code: 'AI_ERROR', message: 'AI 服务调用失败，请重试', status: 500 },
  GETNOTES_ERROR: { code: 'GETNOTES_ERROR', message: 'Get笔记 API 调用失败', status: 500 },
  INTERNAL_ERROR: { code: 'INTERNAL_ERROR', message: '服务器内部错误', status: 500 },
} as const;

/**
 * 发送预定义错误
 * @param res - Vercel 响应对象
 * @param errorType - 错误类型
 * @param customMessage - 可选的自定义消息
 */
export function sendPredefinedError(
  res: VercelResponse,
  errorType: keyof typeof ErrorCodes,
  customMessage?: string
): void {
  const error = ErrorCodes[errorType];
  sendError(res, error.code, customMessage || error.message, error.status);
}


