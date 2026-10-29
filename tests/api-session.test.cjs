const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function clientFixture() {
  let token = 'fixture-A', resolve, resolveJson, authorization;
  const response = new Promise(done => { resolve = done; });
  const json = new Promise(done => { resolveJson = done; });
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync('services/api.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(source, {
    module, exports: module.exports,
    URLSearchParams,
    localStorage: {
      getItem: () => token,
      setItem: (_, value) => { token = value; },
      removeItem: () => { token = null; },
    },
    fetch: async (_, options) => { authorization = options.headers.Authorization; return response; },
  });
  return {
    api: module.exports,
    changeToken: next => { token = next; },
    respond: status => resolve({ status, json: () => json }),
    body: body => resolveJson(body),
    get authorization() { return authorization; },
  };
}

for (const next of [null, 'fixture-B']) {
  for (const success of [true, false]) {
    test(`web API: rejects old ${success ? 'data' : '401'} after ${next ? 'account change' : 'logout'}`, async () => {
      const f = clientFixture();
      const pending = f.api.getMistakes();
      assert.equal(f.authorization, 'Bearer fixture-A');
      f.respond(success ? 200 : 401);
      await Promise.resolve();
      f.changeToken(next);
      f.body({ success, data: { items: ['fixture-private-A'] }, error: { code: 'UNAUTHORIZED' } });
      await assert.rejects(pending, error => error.code === 'SESSION_CHANGED');
    });
  }
}

test('web API: same-session data and errors preserve the original contract', async () => {
  for (const success of [true, false]) {
    const f = clientFixture();
    const pending = f.api.getMistakes();
    f.respond(success ? 200 : 401);
    f.body({ success, data: { items: ['fixture-A'] }, error: { code: 'UNAUTHORIZED', message: 'fixture expired' } });
    if (success) assert.equal((await pending).items[0], 'fixture-A');
    else await assert.rejects(pending, error => error.code === 'UNAUTHORIZED' && error.status === 401);
  }
});
