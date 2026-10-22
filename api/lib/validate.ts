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
 * 图片解码后的上限：3 MB。Vercel 函数请求体最多 4.5 MB，3 MB 图片经 base64 约 4 MB，
 * 加上其余 JSON 字段仍在平台上限内；更大的图片在平台层就会被拒绝。
 */
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

/** https 图片地址的最大长度。 */
export const MAX_IMAGE_URL_LENGTH = 2048;

const DATA_IMAGE_PREFIX_MAX = 'data:image/jpeg;base64,'.length;
const DATA_IMAGE_RE = /^data:image\/(png|jpeg|webp|gif|heic|heif);base64,([A-Za-z0-9+/]+={0,2})$/;

/**
 * 解析 data:image/<类型>;base64,<数据> 形式的图片：类型限 png/jpeg/webp/gif/heic/heif，
 * Base64 必须合法，解码后不超过 maxBytes。有效时返回 MIME 与 Base64 数据，否则返回 null。
 */
export function parseDataImage(v: unknown, maxBytes: number): { mimeType: string; base64: string } | null {
  if (typeof v !== 'string') return null;
  // 先按长度粗筛，超长字符串不进正则
  if (v.length > DATA_IMAGE_PREFIX_MAX + Math.ceil(maxBytes / 3) * 4) return null;
  const m = DATA_IMAGE_RE.exec(v);
  if (!m || m[2].length % 4 !== 0) return null;
  const padding = m[2].endsWith('==') ? 2 : m[2].endsWith('=') ? 1 : 0;
  const bytes = (m[2].length / 4) * 3 - padding;
  if (bytes <= 0 || bytes > maxBytes) return null;
  return { mimeType: `image/${m[1]}`, base64: m[2] };
}

/**
 * 判断是否为 https 图片地址：能被 URL 解析、协议为 https:、主机名非空，总长不超过 maxLen。
 */
export function isHttpsUrl(v: unknown, maxLen: number): v is string {
  if (typeof v !== 'string' || v.length > maxLen || !v.startsWith('https://')) return false;
  try {
    const url = new URL(v);
    return url.protocol === 'https:' && url.hostname.length > 0;
  } catch {
    return false;
  }
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
