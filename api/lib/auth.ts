/**
 * 认证工具模块
 * 提供 JWT 生成/验证和密码加密功能
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import type { VercelRequest } from '@vercel/node';

// JWT 密钥，从环境变量获取（必须配置）
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not configured. Refusing to start with insecure defaults.');
}
const JWT_EXPIRES_IN = '7d'; // Token 有效期 7 天
const SALT_ROUNDS = 10; // bcrypt 加密轮数

/**
 * JWT Payload 类型定义
 */
export interface JWTPayload {
  userId: string;
  username: string;
  iat?: number;
  exp?: number;
}

/**
 * 生成 JWT Token
 * @param payload - Token 载荷数据
 * @returns JWT Token 字符串
 */
export function generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * 验证 JWT Token
 * @param token - JWT Token 字符串
 * @returns 解码后的 Payload，验证失败返回 null
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    return null;
  }
}

/**
 * 从请求头中提取 Token
 * @param req - Vercel 请求对象
 * @returns Token 字符串，未找到返回 null
 */
export function extractToken(req: VercelRequest): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7);
}

/**
 * 验证请求中的 Token 并返回用户信息
 * @param req - Vercel 请求对象
 * @returns 用户信息，验证失败返回 null
 */
export function authenticateRequest(req: VercelRequest): JWTPayload | null {
  const token = extractToken(req);
  if (!token) {
    return null;
  }
  return verifyToken(token);
}

/**
 * 加密密码
 * @param password - 明文密码
 * @returns 加密后的密码哈希
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * 验证密码
 * @param password - 明文密码
 * @param hash - 密码哈希
 * @returns 密码是否匹配
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * 验证用户名格式
 * @param username - 用户名
 * @returns 是否有效
 */
export function isValidUsername(username: string): boolean {
  // 用户名: 3-20 字符，只允许字母、数字、下划线
  return /^[a-zA-Z0-9_]{3,20}$/.test(username);
}

/**
 * 验证密码强度
 * @param password - 密码
 * @returns 是否有效
 */
export function isValidPassword(password: string): boolean {
  // 密码: 至少 6 个字符
  return password.length >= 6;
}


