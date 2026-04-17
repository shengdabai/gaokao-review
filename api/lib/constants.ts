/**
 * 共享常量
 * 避免在各 API 文件中重复定义
 */

/** GetNotes API Topic IDs */
export const GETNOTES_TOPIC_IDS: readonly string[] = ['K0BlyZmn', 'BJ888R8J'];

/** 有效学科 ID 列表 */
export const VALID_SUBJECTS: readonly string[] = ['math', 'physics', 'chemistry', 'chinese', 'english', 'politics'];

export type SubjectId = 'math' | 'physics' | 'chemistry' | 'chinese' | 'english' | 'politics';

/** 学科中文名映射 */
export const SUBJECT_NAMES: Readonly<Record<string, string>> = {
  math: '数学',
  physics: '物理',
  chemistry: '化学',
  chinese: '语文',
  english: '英语',
  politics: '政治',
};

/**
 * 安全解析 JSON 字符串
 * @param jsonStr 要解析的 JSON 字符串
 * @param fallback 解析失败时的默认值
 */
export function safeJsonParse<T>(jsonStr: string | null | undefined, fallback: T): T {
  if (!jsonStr) return fallback;
  try {
    return JSON.parse(jsonStr);
  } catch {
    return fallback;
  }
}
