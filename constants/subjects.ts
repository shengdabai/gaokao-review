/**
 * 学科配置 - Web 前端共享常量
 */

export const SUBJECTS = [
  { id: 'math', name: '数学', icon: '📐', primary: true, color: 'bg-blue-500' },
  { id: 'physics', name: '物理', icon: '⚡', primary: true, color: 'bg-indigo-500' },
  { id: 'chemistry', name: '化学', icon: '🧪', primary: true, color: 'bg-violet-500' },
  { id: 'chinese', name: '语文', icon: '📖', primary: false, color: 'bg-emerald-500' },
  { id: 'english', name: '英语', icon: '🔤', primary: false, color: 'bg-teal-500' },
  { id: 'politics', name: '政治', icon: '⚖️', primary: false, color: 'bg-red-500' },
] as const;

export type SubjectId = typeof SUBJECTS[number]['id'];
