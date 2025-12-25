/**
 * API 常量配置
 */

// API 基础 URL - 部署后更换为实际地址
export const API_BASE_URL = __DEV__ 
  ? 'http://10.0.2.2:3000/api'  // Android 模拟器访问本机
  : 'https://your-vercel-app.vercel.app/api';  // 生产环境

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

