/**
 * 请求输入校验工具
 * 纯函数，不依赖其他模块（便于用 node --test 直接运行）
 */

/**
 * 判断 key 是否为对象自身的属性。
 * 用于代替 `!!obj[key]`，避免 constructor、__proto__、toString 等原型键绕过检查。
 */
export function isOwnKey(obj: object, key: unknown): key is string {
  return typeof key === 'string' && Object.hasOwn(obj, key);
}

/**
 * 判断是否为非空字符串（去掉首尾空白后仍有内容），且长度不超过 max。
 */
export function isNonEmptyString(v: unknown, max: number): v is string {
  return typeof v === 'string' && v.trim().length > 0 && v.length <= max;
}

/**
 * 判断是否为可选字符串：undefined / null 视为未提供，其余必须是长度不超过 max 的字符串。
 */
export function isOptionalString(v: unknown, max: number): v is string | undefined | null {
  return v === undefined || v === null || (typeof v === 'string' && v.length <= max);
}

/**
 * 判断是否为有效学科 ID。validSubjects 由调用方传入（通常是 constants.ts 的 VALID_SUBJECTS）。
 * 用数组成员比较，不会被 constructor 等原型键绕过。
 */
export function isSubjectId(v: unknown, validSubjects: readonly string[]): v is string {
  return typeof v === 'string' && validSubjects.includes(v);
}

/**
 * 把输入转为整数并限制在 [min, max]。非数字、NaN、Infinity 返回 fallback。
 */
export function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, Math.round(v)));
}

/**
 * 规整标签列表：非数组返回 []；只保留字符串，去空白、去空项，
 * 每项最多 maxLen 个字符，最多 maxCount 项。
 */
export function normalizeTags(raw: unknown, maxCount: number, maxLen: number): string[] {
  if (!Array.isArray(raw)) return [];
  const tags: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const tag = item.trim().slice(0, maxLen);
    if (!tag) continue;
    tags.push(tag);
    if (tags.length >= maxCount) break;
  }
  return tags;
}
