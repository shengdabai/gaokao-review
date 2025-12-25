/**
 * API 服务模块
 * 封装所有后端 API 调用
 */

// API 基础 URL
const API_BASE = '/api';

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
 * 获取存储的 Token
 */
export function getToken(): string | null {
  return localStorage.getItem('auth_token');
}

/**
 * 设置 Token
 */
export function setToken(token: string): void {
  localStorage.setItem('auth_token', token);
}

/**
 * 清除 Token
 */
export function clearToken(): void {
  localStorage.removeItem('auth_token');
}

/**
 * 通用 API 请求方法
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
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

export interface UserInfo {
  userId: string;
  username: string;
  createdAt: string;
  stats: {
    totalMistakes: number;
    bySubject: Record<string, number>;
  };
}

/**
 * 用户注册
 */
export async function register(username: string, password: string): Promise<AuthUser> {
  return apiRequest<AuthUser>('/auth?action=register', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

/**
 * 用户登录
 */
export async function login(username: string, password: string): Promise<AuthUser> {
  return apiRequest<AuthUser>('/auth?action=login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

/**
 * 获取当前用户信息
 */
export async function getCurrentUser(): Promise<UserInfo> {
  return apiRequest<UserInfo>('/auth');
}

// ============ AI API ============

export interface AnalyzeResult {
  analysis: string;
  tags: string[];
  subject: string;
  confidence: number;
}

export interface AskResult {
  answer: string;
  question: string;
  subject: string;
}

/**
 * AI 图片分析
 */
export async function analyzeImage(image: string, subject?: string): Promise<AnalyzeResult> {
  return apiRequest<AnalyzeResult>('/ai/analyze', {
    method: 'POST',
    body: JSON.stringify({ image, subject }),
  });
}

/**
 * AI 文本问答
 */
export async function askQuestion(question: string, subject?: string, context?: string): Promise<AskResult> {
  return apiRequest<AskResult>('/ai/ask', {
    method: 'POST',
    body: JSON.stringify({ question, subject, context }),
  });
}

// ============ 笔记 API ============

export interface NotesResult {
  content: string;
  source: 'getnotes' | 'ai';
  query: string;
  subject: string;
}

export interface HistoryItem {
  id: string;
  query: string;
  subject: string | null;
  createdAt: string;
}

/**
 * 搜索知识点笔记
 */
export async function searchNotes(query: string, subject?: string): Promise<NotesResult> {
  return apiRequest<NotesResult>('/notes?action=search', {
    method: 'POST',
    body: JSON.stringify({ query, subject }),
  });
}

/**
 * 获取搜索历史
 */
export async function getSearchHistory(limit: number = 20): Promise<{ items: HistoryItem[]; total: number }> {
  return apiRequest<{ items: HistoryItem[]; total: number }>(`/notes?action=history&limit=${limit}`);
}

/**
 * 清空搜索历史
 */
export async function clearSearchHistory(): Promise<void> {
  return apiRequest<void>('/notes?action=history', { method: 'DELETE' });
}

// ============ 错题本 API ============

export interface MistakeItem {
  id: string;
  subject: string;
  imageUrl: string;
  analysis: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  syncStatus: string;
}

export interface MistakeListResult {
  items: MistakeItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * 获取错题列表
 */
export async function getMistakes(
  options: { subject?: string; tag?: string; page?: number; limit?: number } = {}
): Promise<MistakeListResult> {
  const params = new URLSearchParams();
  if (options.subject) params.append('subject', options.subject);
  if (options.tag) params.append('tag', options.tag);
  if (options.page) params.append('page', options.page.toString());
  if (options.limit) params.append('limit', options.limit.toString());

  const query = params.toString();
  return apiRequest<MistakeListResult>(`/mistakes${query ? `?${query}` : ''}`);
}

/**
 * 获取单条错题
 */
export async function getMistake(id: string): Promise<MistakeItem> {
  return apiRequest<MistakeItem>(`/mistakes/${id}`);
}

/**
 * 添加错题
 */
export async function addMistake(data: {
  subject: string;
  imageUrl: string;
  analysis: string;
  tags?: string[];
}): Promise<{ id: string; createdAt: string }> {
  return apiRequest<{ id: string; createdAt: string }>('/mistakes', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * 删除错题
 */
export async function deleteMistake(id: string): Promise<void> {
  return apiRequest<void>(`/mistakes/${id}`, { method: 'DELETE' });
}

/**
 * 同步错题数据
 */
export async function syncMistakes(data: {
  lastSyncTime?: string;
  localMistakes?: any[];
}): Promise<{
  syncTime: string;
  syncResults: { id: string; status: string }[];
  serverMistakes: MistakeItem[];
}> {
  return apiRequest('/mistakes/sync', {
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

/**
 * AI 导师对话 - 苏格拉底式教学
 */
export async function chatWithTutor(data: {
  sessionId?: string;
  message: string;
  subject: string;
  topic?: string;
  mode?: 'learn' | 'review' | 'quiz';
}): Promise<TutorResponse> {
  return apiRequest<TutorResponse>('/ai/tutor', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ============ 学习进度 API ============

export interface TopicProgress {
  topic: string;
  mastery_level: number;
  times_studied: number;
  times_correct: number;
  times_wrong: number;
  last_studied_at: string | null;
}

export interface SubjectProgress {
  totalTopics: number;
  masteredTopics: number;
  learningTopics: number;
  notStartedTopics: number;
  avgMastery: number;
  progress: TopicProgress[];
  allTopics: string[];
}

export interface StudyProgressResult {
  totalTopics: number;
  masteredTopics: number;
  learningTopics: number;
  notStartedTopics: number;
  overallMastery: number;
  bySubject: Record<string, SubjectProgress>;
}

/**
 * 获取学习进度
 */
export async function getStudyProgress(subject?: string): Promise<StudyProgressResult> {
  const query = subject ? `?subject=${subject}` : '';
  return apiRequest<StudyProgressResult>(`/progress${query}`);
}

/**
 * 更新学习进度
 */
export async function updateStudyProgress(data: {
  subject: string;
  topic: string;
  masteryChange?: number;
  notes?: string;
}): Promise<{ id: string; mastery_level: number; times_studied: number }> {
  return apiRequest('/progress', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ============ 试题分析预测 API ============

export interface PredictAnalysis {
  hotspots: {
    top5: string[];
    analysis: string;
  };
  trends: {
    summary: string;
    changes: string[];
    difficulty: string;
  };
  predictions: {
    mustKnow: string[];
    likelyTopics: string[];
    reasoning: string;
  };
  studyPlan: {
    priority: string[];
    timeAllocation: string;
    strategies: string[];
    commonMistakes: string[];
  };
  examTips: {
    timeManagement: string;
    answeringOrder: string;
    checkPoints: string[];
  };
}

export interface PredictResult {
  subject: string;
  subjectName: string;
  topic: string;
  analysis: PredictAnalysis;
  hasKnowledgeData: boolean;
  userWeakPoints: string[];
  generatedAt: string;
}

/**
 * 高考试题分析与预测
 */
export async function predictExam(subject: string, topic?: string): Promise<PredictResult> {
  return apiRequest<PredictResult>('/ai/predict', {
    method: 'POST',
    body: JSON.stringify({ subject, topic }),
  });
}


