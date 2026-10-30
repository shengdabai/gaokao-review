/**
 * API handler 输入校验测试（不连数据库、不调 Gemini、不联网）
 * 运行: node --test tests/handlers.test.mjs（需要 Node ≥ 22.6 的 TypeScript 类型擦除；Node 24 默认开启）
 *
 * 做法：把 api/ 复制到临时目录，给相对导入补上 .ts 后缀，再用桩替换 auth、db 与 @google/generative-ai，
 * 然后用假的 req/res 直接调用各 handler。放在 tests/ 而不是 api/ 下，Vercel 不会把它当成函数构建。
 */

import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gaokao-handlers-'));
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

fs.cpSync(path.join(root, 'api'), path.join(tmp, 'api'), { recursive: true });
fs.writeFileSync(path.join(tmp, 'package.json'), '{"type":"module"}');
for (const file of fs.globSync('api/**/*.ts', { cwd: tmp })) {
  const p = path.join(tmp, file);
  const source = fs.readFileSync(p, 'utf8');
  fs.writeFileSync(p, source.replace(/from '(\.\.?\/[^']+?)'/g, (m, spec) => (spec.endsWith('.ts') ? m : `from '${spec}.ts'`)));
}
fs.writeFileSync(path.join(tmp, 'api/lib/auth.ts'), `export function authenticateRequest() { return { userId: 'u1' }; }`);
fs.writeFileSync(path.join(tmp, 'api/lib/db.ts'), `
const state = (globalThis.__gaokaoDb ??= { calls: [], progressRows: [] });
export function generateId() { return 'id' + state.calls.length; }
export function getDatabase() {
  const record = (name) => async (...args) => { state.calls.push(name); };
  return {
    getStudyProgress: async () => state.progressRows,
    createMistake: record('createMistake'),
    createSearchHistory: record('createSearchHistory'),
    getTutorSession: async () => null,
    createTutorSession: record('createTutorSession'),
    createTutorMessage: record('createTutorMessage'),
    getTutorMessages: async () => [],
  };
}`);
const gemini = path.join(tmp, 'node_modules/@google/generative-ai');
fs.mkdirSync(gemini, { recursive: true });
fs.writeFileSync(path.join(gemini, 'package.json'), '{"name":"@google/generative-ai","main":"index.js"}');
fs.writeFileSync(path.join(gemini, 'index.js'), `
exports.GoogleGenerativeAI = class {
  getGenerativeModel() {
    return { async generateContent() { globalThis.__gaokaoGemini = (globalThis.__gaokaoGemini || 0) + 1; return { response: { text: () => '【标签】函数\\n回答' } }; } };
  }
};`);
process.env.GEMINI_API_KEY = 'test-placeholder';

const db = (globalThis.__gaokaoDb ??= { calls: [], progressRows: [] });
const load = (name) => import(path.join(tmp, `api/${name}/index.ts`));
const [progress, mistakes, ai, notes] = await Promise.all(['progress', 'mistakes', 'ai', 'notes'].map(load));

async function call(mod, method, body, query = {}) {
  const out = { status: 0, body: null };
  const res = {
    setHeader() {},
    end() { return res; },
    status(code) { out.status = code; return res; },
    json(payload) { out.body = payload; return res; },
  };
  db.calls.length = 0;
  globalThis.__gaokaoGemini = 0;
  await mod.default({ method, body, query, headers: {} }, res);
  return { ...out, writes: [...db.calls], gemini: globalThis.__gaokaoGemini };
}

const jpeg = (bytes) => `data:image/jpeg;base64,${Buffer.alloc(bytes, 7).toString('base64')}`;
const OVER_3MB = 3 * 1024 * 1024 + 3;

test('progress GET 跳过历史遗留的原型键学科记录，仍返回 200', async () => {
  db.progressRows = [
    { subject: 'constructor', topic: 'x', mastery_level: 10 },
    { subject: '__proto__', topic: 'y', mastery_level: 20 },
    { subject: 'toString', topic: 'z', mastery_level: 30 },
    { subject: 'math', topic: '概率', mastery_level: 50 },
  ];
  const r = await call(progress, 'GET', undefined);
  db.progressRows = [];
  assert.equal(r.status, 200);
  const bySubject = r.body.data.bySubject;
  assert.equal(bySubject.math.progress.length, 1);
  assert.equal(Object.hasOwn(bySubject, 'constructor'), false);
  assert.equal(Object.hasOwn(bySubject, 'toString'), false);
});

test('mistakes POST 拒绝无效或过大的图片，不写库', async () => {
  const ok = { subject: 'math', analysis: '分析', tags: ['t'] };
  const bad = {
    'https:// 无主机': 'https://',
    'https 无法解析': 'https://[invalid',
    'https 超长': `https://example.com/${'a'.repeat(3000)}`,
    'data:image/ 无数据': 'data:image/',
    '非法 Base64 字符': 'data:image/png;base64,@@@@',
    'Base64 长度不是 4 的倍数': 'data:image/png;base64,AAA',
    'svg': 'data:image/svg+xml;base64,PHN2Zz4=',
    '超过 3 MB': jpeg(OVER_3MB),
    '100 万字符': 'h'.repeat(1_000_000),
    '数字': 42,
  };
  for (const [label, imageUrl] of Object.entries(bad)) {
    const r = await call(mistakes, 'POST', { ...ok, imageUrl });
    assert.equal(r.status, 400, label);
    assert.deepEqual(r.writes, [], label);
  }
  for (const imageUrl of [jpeg(1024), 'https://cdn.example.com/q.png']) {
    const r = await call(mistakes, 'POST', { ...ok, imageUrl });
    assert.equal(r.status, 201, imageUrl.slice(0, 30));
  }
});

test('ai tutor 的 mode 只接受 learn/review/quiz，超长或其他值返回 400 且不写库', async () => {
  for (const mode of ['x'.repeat(1_000_000), 'hack', 42]) {
    const r = await call(ai, 'POST', { message: '你好', subject: 'math', mode }, { action: 'tutor' });
    assert.equal(r.status, 400, String(mode).slice(0, 10));
    assert.deepEqual(r.writes, []);
  }
  const r = await call(ai, 'POST', { message: '你好', subject: 'math', mode: 'quiz' }, { action: 'tutor' });
  assert.equal(r.status, 200);
  assert.ok(r.writes.includes('createTutorSession'));
});

test('ai analyze / ask 的非字符串输入返回 400，超过 3 MB 的图片不进入 Gemini', async () => {
  for (const image of [42, { a: 1 }, jpeg(OVER_3MB)]) {
    const r = await call(ai, 'POST', { image }, { action: 'analyze' });
    assert.equal(r.status, 400);
    assert.equal(r.gemini, 0);
  }
  const okImage = await call(ai, 'POST', { image: jpeg(1024) }, { action: 'analyze' });
  assert.equal(okImage.status, 200);
  assert.equal(okImage.gemini, 1);

  for (const question of [42, ['q'], { q: 1 }]) {
    const r = await call(ai, 'POST', { question }, { action: 'ask' });
    assert.equal(r.status, 400);
    assert.equal(r.gemini, 0);
  }
});

test('notes search 的 subject 必须是有效学科，query 必须是字符串', async () => {
  for (const subject of ['x'.repeat(1_000_000), 'constructor', 42]) {
    const r = await call(notes, 'POST', { query: '函数', subject }, { action: 'search' });
    assert.equal(r.status, 400, String(subject).slice(0, 12));
    assert.deepEqual(r.writes, []);
  }
  const noQuery = await call(notes, 'POST', { query: 42 }, { action: 'search' });
  assert.equal(noQuery.status, 400);
  for (const subject of ['math', undefined]) {
    const r = await call(notes, 'POST', { query: '函数', subject }, { action: 'search' });
    assert.equal(r.status, 200, String(subject));
    assert.deepEqual(r.writes, ['createSearchHistory']);
  }
});
