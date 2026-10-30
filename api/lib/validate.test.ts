/**
 * 输入校验工具测试
 * 运行: node --test api/lib/validate.test.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isOwnKey,
  isNonEmptyString,
  isOptionalString,
  isSubjectId,
  clampInt,
  normalizeTags,
  parseDataImage,
  isHttpsUrl,
  MAX_IMAGE_BYTES,
} from './validate.ts';

const SUBJECTS = ['math', 'physics', 'chemistry', 'chinese', 'english', 'politics'];

test('isOwnKey: 自有键通过', () => {
  assert.equal(isOwnKey({ math: [] }, 'math'), true);
});

test('isOwnKey: 原型键不通过', () => {
  const topics = { math: [] };
  for (const key of ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf']) {
    assert.equal(isOwnKey(topics, key), false, key);
    // 对照：旧写法 !!obj[key] 会放行这些键
    assert.equal(!!(topics as Record<string, unknown>)[key], true, `legacy ${key}`);
  }
});

test('isOwnKey: 非字符串键不通过', () => {
  assert.equal(isOwnKey({ math: [] }, undefined), false);
  assert.equal(isOwnKey({ math: [] }, 1), false);
  assert.equal(isOwnKey({ math: [] }, ['math']), false);
});

test('isNonEmptyString: 长度边界', () => {
  assert.equal(isNonEmptyString('a'.repeat(100), 100), true);
  assert.equal(isNonEmptyString('a'.repeat(101), 100), false);
});

test('isNonEmptyString: 空串、纯空白、非字符串不通过', () => {
  assert.equal(isNonEmptyString('', 10), false);
  assert.equal(isNonEmptyString('   ', 10), false);
  assert.equal(isNonEmptyString(undefined, 10), false);
  assert.equal(isNonEmptyString(123, 10), false);
  assert.equal(isNonEmptyString({ trim: () => 'x' }, 10), false);
});

test('isOptionalString: 未提供、边界、非字符串', () => {
  assert.equal(isOptionalString(undefined, 5), true);
  assert.equal(isOptionalString(null, 5), true);
  assert.equal(isOptionalString('', 5), true);
  assert.equal(isOptionalString('abcde', 5), true);
  assert.equal(isOptionalString('abcdef', 5), false);
  assert.equal(isOptionalString(5, 5), false);
  assert.equal(isOptionalString({}, 5), false);
});

test('isSubjectId: 有效学科通过', () => {
  for (const s of SUBJECTS) assert.equal(isSubjectId(s, SUBJECTS), true, s);
});

test('isSubjectId: 无效学科、原型键、非字符串不通过', () => {
  for (const s of ['constructor', '__proto__', 'toString', 'Math', 'biology', '']) {
    assert.equal(isSubjectId(s, SUBJECTS), false, s);
  }
  assert.equal(isSubjectId(undefined, SUBJECTS), false);
  assert.equal(isSubjectId(['math'], SUBJECTS), false);
});

test('clampInt: 取整并限制范围', () => {
  assert.equal(clampInt(5, -100, 100, 0), 5);
  assert.equal(clampInt(3.6, -100, 100, 0), 4);
  assert.equal(clampInt(-3.4, -100, 100, 0), -3);
  assert.equal(clampInt(101, -100, 100, 0), 100);
  assert.equal(clampInt(-1000, -100, 100, 0), -100);
});

test('clampInt: 非数字、NaN、Infinity 返回 fallback', () => {
  assert.equal(clampInt('5', -100, 100, 7), 7);
  assert.equal(clampInt(undefined, -100, 100, 7), 7);
  assert.equal(clampInt(null, -100, 100, 7), 7);
  assert.equal(clampInt(NaN, -100, 100, 7), 7);
  assert.equal(clampInt(Infinity, -100, 100, 7), 7);
  assert.equal(clampInt(JSON.parse('1e999'), -100, 100, 7), 7);
});

test('normalizeTags: 非数组返回空数组', () => {
  assert.deepEqual(normalizeTags(undefined, 20, 30), []);
  assert.deepEqual(normalizeTags('a,b', 20, 30), []);
  assert.deepEqual(normalizeTags({ length: 2 }, 20, 30), []);
});

test('normalizeTags: 过滤非字符串和空项，并去空白', () => {
  assert.deepEqual(normalizeTags([' 函数 ', '', '  ', 1, null, { a: 1 }, '导数'], 20, 30), ['函数', '导数']);
});

test('normalizeTags: 数量与单项长度上限', () => {
  const many = Array.from({ length: 25 }, (_, i) => `t${i}`);
  assert.equal(normalizeTags(many, 20, 30).length, 20);
  assert.deepEqual(normalizeTags(['a'.repeat(31)], 20, 30), ['a'.repeat(30)]);
});

const b64 = (bytes: number) => Buffer.alloc(bytes, 1).toString('base64');

test('parseDataImage: 合法图片返回 MIME 与数据', () => {
  assert.deepEqual(parseDataImage(`data:image/png;base64,${b64(3)}`, 10), { mimeType: 'image/png', base64: b64(3) });
  for (const type of ['jpeg', 'webp', 'gif', 'heic', 'heif']) {
    assert.equal(parseDataImage(`data:image/${type};base64,${b64(4)}`, 10)?.mimeType, `image/${type}`);
  }
});

test('parseDataImage: 类型、编码、长度不合法返回 null', () => {
  for (const v of [
    42, null, undefined, '',
    'data:image/',
    'data:image/png;base64,',
    'data:image/png;base64,@@@@',
    'data:image/png;base64,AAA',
    'data:image/svg+xml;base64,PHN2Zz4=',
    `data:text/plain;base64,${b64(3)}`,
    `data:image/png,${b64(3)}`,
  ]) {
    assert.equal(parseDataImage(v, 10), null, String(v));
  }
});

test('parseDataImage: 按解码后的字节数限制大小', () => {
  assert.notEqual(parseDataImage(`data:image/png;base64,${b64(10)}`, 10), null);
  assert.equal(parseDataImage(`data:image/png;base64,${b64(11)}`, 10), null);
  assert.equal(parseDataImage(`data:image/png;base64,${b64(MAX_IMAGE_BYTES + 1)}`, MAX_IMAGE_BYTES), null);
});

test('isHttpsUrl: 只接受可解析、有主机名、不超长的 https 地址', () => {
  assert.equal(isHttpsUrl('https://cdn.example.com/a.png', 100), true);
  for (const v of ['https://', 'https://[invalid', 'http://example.com/a.png', 'javascript:alert(1)', 42, `https://e.com/${'a'.repeat(100)}`]) {
    assert.equal(isHttpsUrl(v, 100), false, String(v));
  }
});
