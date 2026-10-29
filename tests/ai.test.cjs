const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Run the real handler with synthetic data; never load credentials, a DB or an SDK.
function createApi(output = 'fixture answer') {
  const calls = { model: [], database: [], network: 0 };
  const database = Object.fromEntries([
    'getWeakTopics', 'getTutorMessages', 'createTutorSession', 'createTutorMessage',
  ].map(name => [name, async (...args) => {
    calls.database.push({ name, args });
    return [];
  }]));
  const mocks = {
    '@google/generative-ai': {
      GoogleGenerativeAI: class {
        getGenerativeModel() {
          return { generateContent: async prompt => {
            calls.model.push(prompt);
            return { response: { text: () => output } };
          } };
        }
      },
    },
    '../lib/auth': { authenticateRequest: () => ({ userId: 'fixture-user' }) },
    '../lib/db': { getDatabase: () => database, generateId: () => 'fixture-id' },
    '../lib/cors': { handleCors: () => false },
  };
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} };
    cache.set(file, module);
    const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    vm.runInNewContext(source, {
      module, exports: module.exports,
      require: specifier => {
        if (Object.hasOwn(mocks, specifier)) return mocks[specifier];
        if (!specifier.startsWith('.')) throw new Error(`Unexpected import: ${specifier}`);
        return load(path.resolve(path.dirname(file), `${specifier}.ts`));
      },
      process: { env: { GEMINI_API_KEY: 'fixture-placeholder' } },
      fetch: async () => { calls.network++; throw new Error('Network disabled in unit tests'); },
      console: { error() {}, warn() {} },
    }, { filename: file });
    return module.exports;
  }
  const handler = load(path.resolve(__dirname, '../api/ai/index.ts')).default;
  return {
    calls,
    async request(action, body) {
      const response = {
        statusCode: 200,
        status(code) { this.statusCode = code; return this; },
        json(data) { this.body = data; return this; },
      };
      await handler({ method: 'POST', query: { action }, body }, response);
      assert.equal(calls.network, 0);
      return response;
    },
  };
}

const prediction = {
  hotspots: { top5: ['函数'], analysis: 'fixture analysis' },
  trends: { summary: 'fixture trend', changes: ['fixture change'], difficulty: '中等' },
  predictions: { mustKnow: ['导数'], likelyTopics: ['函数'], reasoning: 'fixture reason' },
  studyPlan: { priority: ['基础'], timeAllocation: '30分钟', strategies: ['练习'], commonMistakes: [] },
  examTips: { timeManagement: '预留检查', answeringOrder: '先易后难', checkPoints: ['计算'] },
};

for (const action of ['ask', 'analyze', 'tutor', 'predict']) {
  for (const [name, body] of [['missing', undefined], ['null', null], ['array', []], ['string', 'text']]) {
    test(`${action}: rejects ${name} request body without external work`, async () => {
      const api = createApi();
      const response = await api.request(action, body);
      assert.equal(response.statusCode, 400);
      assert.equal(response.body.error.code, 'INVALID_REQUEST');
      assert.equal(api.calls.model.length, 0);
      assert.equal(api.calls.database.length, 0);
    });
  }
}

for (const [action, body] of [
  ['ask', { question: 123 }],
  ['ask', { question: ['question'] }],
  ['ask', { question: '   ' }],
  ['ask', { question: 'x'.repeat(2001) }],
  ['analyze', { image: 123 }],
  ['analyze', { image: {} }],
  ['analyze', { image: 'not an image' }],
  ['tutor', { message: true, subject: 'math' }],
  ['tutor', { message: ['question'], subject: 'math' }],
  ['tutor', { message: 'question', subject: 'invalid-subject' }],
  ['predict', { subject: 'invalid-subject' }],
  ['predict', { subject: ['math'] }],
]) {
  test(`${action}: rejects invalid input ${JSON.stringify(body).slice(0, 85)}`, async () => {
    const api = createApi();
    const response = await api.request(action, body);
    assert.equal(response.statusCode, 400);
    assert.equal(response.body.error.code, 'INVALID_REQUEST');
    assert.equal(api.calls.model.length, 0);
    assert.equal(api.calls.database.length, 0);
  });
}

for (const [name, output] of [
  ['plain JSON', JSON.stringify(prediction)],
  ['fenced JSON', `\`\`\`json\n${JSON.stringify(prediction)}\n\`\`\``],
]) {
  test(`predict: accepts complete ${name}`, async () => {
    const api = createApi(output);
    const response = await api.request('predict', { subject: 'math' });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.success, true);
    assert.equal(JSON.stringify(response.body.data.analysis), JSON.stringify(prediction));
    assert.equal(api.calls.model.length, 1);
  });
}

for (const [name, output] of [
  ['non-JSON text', 'Sorry, no prediction is available.'],
  ['malformed JSON', '{"hotspots":'],
  ['empty object', '{}'],
  ['missing section', JSON.stringify({ hotspots: prediction.hotspots })],
  ['null section', JSON.stringify({ ...prediction, trends: null })],
  ['invalid list', JSON.stringify({ ...prediction, hotspots: { ...prediction.hotspots, top5: '函数' } })],
  ['invalid list item', JSON.stringify({ ...prediction, hotspots: { ...prediction.hotspots, top5: [null] } })],
  ['invalid text', JSON.stringify({ ...prediction, examTips: { ...prediction.examTips, timeManagement: {} } })],
]) {
  test(`predict: rejects ${name} instead of reporting success`, async () => {
    const api = createApi(output);
    const response = await api.request('predict', { subject: 'math' });
    assert.equal(response.statusCode, 500);
    assert.equal(response.body.success, false);
    assert.equal(response.body.error.code, 'AI_ERROR');
    assert.equal(api.calls.model.length, 1);
  });
}

test('ask: valid question still returns the answer', async () => {
  const api = createApi('fixture answer');
  const response = await api.request('ask', { question: '什么是函数？', subject: 'math' });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.answer, 'fixture answer');
});

test('analyze: valid data URL still returns analysis and tags', async () => {
  const api = createApi('【标签】函数，导数\n【详细解答】fixture explanation');
  const response = await api.request('analyze', { image: 'data:image/png;base64,ZmFrZQ==', subject: 'math' });
  assert.equal(response.statusCode, 200);
  assert.equal(JSON.stringify(response.body.data.tags), JSON.stringify(['函数', '导数']));
});

test('tutor: valid new conversation still stores both messages', async () => {
  const api = createApi('fixture reply');
  const response = await api.request('tutor', { message: '请讲解函数', subject: 'math' });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.response, 'fixture reply');
  assert.equal(api.calls.database.filter(call => call.name === 'createTutorMessage').length, 2);
});
