/**
 * API 服务模块 - React Native 版本
 */

import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '@/constants/api';

const TOKEN_KEY = 'auth_token';

/**
 * 获取存储的 Token
 */
export async function getToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * 设置 Token
 */
export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

/**
 * 清除 Token
 */
export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

/**
 * API 响应类型
 */
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * 通用 API 请求方法
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getToken();

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const result: ApiResponse<T> = await response.json();

  if (!result.success) {
    const error = new Error(result.error?.message || '请求失败');
    (error as any).code = result.error?.code;
    (error as any).status = response.status;
    throw error;
  }

  return result.data as T;
}

// ============ 认证 API ============

export interface AuthUser {
  userId: string;
  username: string;
  token: string;
}

export async function register(username: string, password: string): Promise<AuthUser> {
  return apiRequest<AuthUser>('/auth?action=register', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export async function login(username: string, password: string): Promise<AuthUser> {
  return apiRequest<AuthUser>('/auth?action=login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export async function getCurrentUser(): Promise<any> {
  return apiRequest<any>('/auth');
}

// ============ AI API ============

export interface AnalyzeResult {
  analysis: string;
  tags: string[];
  subject: string;
  confidence: number;
}

export async function analyzeImage(imageBase64: string, subject?: string): Promise<AnalyzeResult> {
  return apiRequest<AnalyzeResult>('/ai?action=analyze', {
    method: 'POST',
    body: JSON.stringify({ image: imageBase64, subject }),
  });
}

// ============ 笔记 API ============

export interface NotesResult {
  content: string;
  source: 'getnotes' | 'ai';
  query: string;
}

export async function searchNotes(query: string, subject?: string): Promise<NotesResult> {
  return apiRequest<NotesResult>('/notes?action=search', {
    method: 'POST',
    body: JSON.stringify({ query, subject }),
  });
}

// ============ 错题本 API ============

export interface MistakeItem {
  id: string;
  subject: string;
  imageUrl: string;
  analysis: string;
  tags: string[];
  createdAt: string;
}

export async function getMistakes(options: { subject?: string; page?: number; limit?: number } = {}): Promise<{ items: MistakeItem[]; pagination: any }> {
  const params = new URLSearchParams();
  if (options.subject) params.append('subject', options.subject);
  if (options.page) params.append('page', options.page.toString());
  if (options.limit) params.append('limit', options.limit.toString());

  const query = params.toString();
  return apiRequest(`/mistakes${query ? `?${query}` : ''}`);
}

export async function addMistake(data: {
  subject: string;
  imageUrl: string;
  analysis: string;
  tags?: string[];
}): Promise<{ id: string }> {
  return apiRequest('/mistakes', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteMistake(id: string): Promise<void> {
  return apiRequest(`/mistakes?id=${id}`, { method: 'DELETE' });
}

export async function syncMistakes(data: {
  lastSyncTime?: string;
  localMistakes?: any[];
}): Promise<any> {
  return apiRequest('/mistakes?action=sync', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ============ AI 导师 API ============

export interface TutorResponse {
  sessionId: string;
  isNewSession: boolean;
  response: string;
  subject: string;
  topic?: string;
  mode: string;
  hasKnowledgeContext: boolean;
}

export async function chatWithTutor(data: {
  sessionId?: string;
  message: string;
  subject: string;
  topic?: string;
  mode?: 'learn' | 'review' | 'quiz';
}): Promise<TutorResponse> {
  return apiRequest<TutorResponse>('/ai?action=tutor', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ============ 学习进度 API ============

export interface StudyProgressResult {
  totalTopics: number;
  masteredTopics: number;
  learningTopics: number;
  notStartedTopics: number;
  overallMastery: number;
  bySubject: Record<string, any>;
}

export async function getStudyProgress(subject?: string): Promise<StudyProgressResult> {
  const query = subject ? `?subject=${subject}` : '';
  return apiRequest<StudyProgressResult>(`/progress${query}`);
}

// ============ 试题分析预测 API ============

export async function predictExam(subject: string, topic?: string): Promise<any> {
  return apiRequest('/ai?action=predict', {
    method: 'POST',
    body: JSON.stringify({ subject, topic }),
  });
}

