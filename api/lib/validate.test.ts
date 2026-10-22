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
