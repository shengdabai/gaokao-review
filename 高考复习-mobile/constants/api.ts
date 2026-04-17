/**
 * API 常量配置
 */

// API 基础 URL - Vercel 部署地址
export const API_BASE_URL = 'https://gaokao-fuxi.vercel.app/api';

// 学科配置
export const SUBJECTS = [
  { id: 'math', name: '数学', icon: '📐', primary: true, color: '#3b82f6' },
  { id: 'physics', name: '物理', icon: '⚡', primary: true, color: '#6366f1' },
  { id: 'chemistry', name: '化学', icon: '🧪', primary: true, color: '#8b5cf6' },
  { id: 'chinese', name: '语文', icon: '📖', primary: false, color: '#10b981' },
  { id: 'english', name: '英语', icon: '🔤', primary: false, color: '#14b8a6' },
  { id: 'politics', name: '政治', icon: '⚖️', primary: false, color: '#ef4444' },
] as const;

export type SubjectId = typeof SUBJECTS[number]['id'];

