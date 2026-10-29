const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

// Execute real hooks/components with deterministic lifecycle and API substitutes.
// This never imports the real API client, browser storage, credentials or network.
function renderModule(file, exported, api, initialProps = {}) {
  const slots = [], effects = [];
  const listeners = new Map();
  let cursor, value, dirty = true, active = true, props = initialProps;
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    Fragment: 'fragment',
    useState(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      return [slots[i], next => {
        if (!active) return;
        slots[i] = typeof next === 'function' ? next(slots[i]) : next;
        dirty = true;
      }];
    },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
    useCallback(fn, deps) {
      const i = cursor++;
      if (!slots[i] || deps.some((dep, j) => dep !== slots[i].deps[j])) slots[i] = { deps, fn };
      return slots[i].fn;
    },
    useEffect(fn, deps) {
      const i = cursor++, old = slots[i];
      if (!old || deps.some((dep, j) => dep !== old.deps[j])) {
        effects.push(() => { old?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; });
      }
    },
  };
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React },
  }).outputText;
  vm.runInNewContext(source, {
    module, exports: module.exports,
    require(name) {
      if (name === 'react') return { ...react, default: react };
      if (name === '../services/api') return api;
      if (name === 'lucide-react') return new Proxy({}, { get: (_, key) => String(key) });
      throw new Error(`Unexpected import: ${name}`);
    },
    document: { addEventListener() {}, removeEventListener() {} },
    window: {
      addEventListener: (type, handler) => listeners.set(type, handler),
      removeEventListener: type => listeners.delete(type),
    },
    console: { error() {} },
  });
  function flush() {
    for (let i = 0; dirty && active; i++) {
      assert.ok(i < 20, 'render settles');
      dirty = false; cursor = 0;
      value = module.exports[exported](props);
      effects.splice(0).forEach(fn => fn());
    }
  }
  function nodes(node) {
    if (arguments.length === 0) node = value;
    if (Array.isArray(node)) return node.flatMap(child => nodes(child));
    if (!node || typeof node !== 'object') return [];
    return [node, ...nodes(node.props?.children)];
  }
  function text(node) {
    if (arguments.length === 0) node = value;
    if (Array.isArray(node)) return node.map(child => text(child)).join('');
    return node && typeof node === 'object' ? text(node.props?.children) : String(node ?? '');
  }
  flush();
  return {
    get value() { return value; }, flush, nodes, text,
    update(next) { props = { ...props, ...next }; dirty = true; flush(); },
    storageEvent(key) { listeners.get('storage')?.({ key }); flush(); },
    unmount() { active = false; slots.forEach(slot => slot?.cleanup?.()); },
    async settle() { for (let i = 0; i < 8; i++) { await Promise.resolve(); flush(); } },
    click(label) {
      const button = nodes().find(n => n.type === 'button' && (text(n).includes(label) || n.props.title === label));
      assert.ok(button, `button ${label} exists`);
      const pending = button.props.onClick(); flush(); return pending;
    },
  };
}

function authFixture(overrides = {}, initialToken = 'fixture-token') {
  let token = initialToken;
  const calls = { writes: 0, clears: 0 };
  const api = {
    getToken: () => token,
    setToken: next => { token = next; calls.writes++; },
    clearToken: () => { token = null; calls.clears++; },
    getCurrentUser: async () => ({ userId: 'A', username: 'fixture-A' }),
    login: async () => ({ token: 'fixture-B-token' }),
    register: async () => ({ token: 'fixture-B-token', userId: 'B', username: 'fixture-B' }),
    ...overrides,
  };
  const app = renderModule('hooks/useAuth.ts', 'useAuth', api);
  return { app, calls, replaceToken: next => { token = next; }, get token() { return token; } };
}

for (const outcome of ['success', 'unauthorized']) {
  test(`auth: late refresh ${outcome} cannot restore login or clear a new token after logout`, async () => {
    const request = deferred();
    const f = authFixture({ getCurrentUser: () => request.promise });
    f.app.value.logout(); f.app.flush();
    if (outcome === 'success') request.resolve({ userId: 'A' });
    else request.reject(Object.assign(new Error('expired'), { status: 401 }));
    await f.app.settle();
    assert.equal(f.app.value.isLoggedIn, false);
    assert.equal(f.app.value.user, null);
    assert.equal(f.app.value.error, null);
    assert.equal(f.app.value.isLoading, false);
    assert.equal(f.calls.clears, 1);
  });
}

for (const method of ['login', 'register']) {
  test(`auth: late ${method} response after logout cannot persist a token`, async () => {
    const request = deferred();
    const f = authFixture({ [method]: () => request.promise }, null);
    const pending = f.app.value[method]('fixture', 'fixture');
    f.app.flush(); f.app.value.logout(); f.app.flush();
    request.resolve({ token: 'fixture-late', userId: 'B', username: 'fixture-B' });
    assert.equal(await pending, false);
    await f.app.settle();
    assert.equal(f.calls.writes, 0);
    assert.equal(f.token, null);
    assert.equal(f.app.value.isLoggedIn, false);
  });
}

test('auth: old 401 refresh cannot sign out a newer successful login', async () => {
  const old = deferred();
  let lookups = 0;
  const f = authFixture({ getCurrentUser: () => ++lookups === 1 ? old.promise : Promise.resolve({ userId: 'B' }) });
  assert.equal(await f.app.value.login('fixture', 'fixture'), true);
  await f.app.settle();
  old.reject(Object.assign(new Error('expired A'), { status: 401 }));
  await f.app.settle();
  assert.equal(f.token, 'fixture-B-token');
  assert.equal(f.app.value.user.userId, 'B');
  assert.equal(f.app.value.isLoggedIn, true);
  assert.equal(f.calls.clears, 0);
});

test('auth: unmount invalidates a pending login before it can store credentials', async () => {
  const request = deferred();
  const f = authFixture({ login: () => request.promise }, null);
  const pending = f.app.value.login('fixture', 'fixture');
  f.app.unmount();
  request.resolve({ token: 'fixture-late' });
  assert.equal(await pending, false);
  assert.equal(f.calls.writes, 0);
});

test('auth: logout while login loads user details discards the late profile', async () => {
  const request = deferred();
  const f = authFixture({ getCurrentUser: () => request.promise }, null);
  const pending = f.app.value.login('fixture', 'fixture');
  await f.app.settle();
  assert.equal(f.calls.writes, 1);
  f.app.value.logout(); f.app.flush();
  request.resolve({ userId: 'B' });
  assert.equal(await pending, false);
  await f.app.settle();
  assert.equal(f.app.value.user, null);
  assert.equal(f.token, null);
});

test('auth: another tab logout hides the authenticated page and ignores unrelated storage', async () => {
  const f = authFixture();
  await f.app.settle();
  f.app.storageEvent('app_search_history:A');
  assert.equal(f.app.value.isLoggedIn, true);
  f.replaceToken(null);
  f.app.storageEvent('auth_token');
  await f.app.settle();
  assert.equal(f.app.value.isLoggedIn, false);
  assert.equal(f.app.value.user, null);
  assert.equal(f.app.value.isLoading, false);
});

test('auth: another tab account change hides A until B is verified', async () => {
  const request = deferred(); let calls = 0;
  const f = authFixture({ getCurrentUser: () => ++calls === 1 ? Promise.resolve({ userId: 'A' }) : request.promise });
  await f.app.settle();
  f.replaceToken('fixture-B');
  f.app.storageEvent('auth_token');
  assert.equal(f.app.value.user, null);
  assert.equal(f.app.value.isLoggedIn, false);
  request.resolve({ userId: 'B' });
  await f.app.settle();
  assert.equal(f.app.value.user.userId, 'B');
  assert.equal(f.app.value.isLoggedIn, true);
  f.replaceToken(null);
  f.app.storageEvent(null); // localStorage.clear() in the other tab
  await f.app.settle();
  assert.equal(f.app.value.isLoggedIn, false);
});

const math = { id: 'math', name: '数学', icon: 'M' };
const physics = { id: 'physics', name: '物理', icon: 'P' };

for (const reset of ['subject', 'mode', 'new-chat', 'unmount']) {
  test(`tutor: ${reset} invalidates the previous response and session`, async () => {
    const first = deferred(), second = deferred(), calls = [];
    const app = renderModule('components/TutorChat.tsx', 'TutorChat', {
      chatWithTutor: args => { calls.push(args); return calls.length === 1 ? first.promise : second.promise; },
    }, { subject: math, onLogout() { assert.fail('stale request must not log out'); } });
    const pending = app.click('三角函数的诱导公式怎么记');
    if (reset === 'subject') app.update({ subject: physics });
    if (reset === 'mode') { app.click('学习模式'); app.click('测验模式'); }
    if (reset === 'new-chat') app.click('开始新对话');
    if (reset === 'unmount') app.unmount();
    if (reset === 'unmount') first.reject(Object.assign(new Error('stale-error'), { code: 'UNAUTHORIZED' }));
    else first.resolve({ sessionId: 'stale-session', response: 'stale-answer' });
    await pending; await app.settle();
    assert.doesNotMatch(app.text(), /stale-answer/);
    if (reset !== 'unmount') {
      const next = app.click(reset === 'subject' ? '牛顿三定律分别是什么' : '三角函数的诱导公式怎么记');
      assert.equal(calls.length, 2, 'new conversation must be usable immediately');
      assert.equal(calls[1].sessionId, undefined);
      if (reset === 'mode') assert.equal(calls[1].mode, 'quiz');
      second.resolve({ sessionId: 'new-session', response: 'current-answer' });
      await next; await app.settle();
      assert.match(app.text(), /current-answer/);
    }
  });
}

test('tutor: stale rejection cannot log out or release the newer request loading state', async () => {
  const old = deferred(), current = deferred(); let calls = 0, logouts = 0;
  const app = renderModule('components/TutorChat.tsx', 'TutorChat', {
    chatWithTutor: () => ++calls === 1 ? old.promise : current.promise,
  }, { subject: math, onLogout: () => logouts++ });
  const first = app.click('三角函数的诱导公式怎么记');
  app.click('开始新对话');
  const second = app.click('三角函数的诱导公式怎么记');
  old.reject(Object.assign(new Error('stale-error'), { code: 'UNAUTHORIZED' }));
  await first; await app.settle();
  assert.equal(logouts, 0);
  assert.equal(app.nodes().find(n => n.type === 'textarea').props.disabled, true);
  current.resolve({ sessionId: 'new-session', response: 'current-answer' });
  await second; await app.settle();
  assert.equal(app.nodes().find(n => n.type === 'textarea').props.disabled, false);
});

for (const outcome of ['success', 'unauthorized']) {
  test(`prediction: subject change discards old ${outcome} without stopping a newer analysis`, async () => {
    const old = deferred(), current = deferred(); let calls = 0, logouts = 0;
    const app = renderModule('components/PredictAnalysis.tsx', 'PredictAnalysis', {
      predictExam: () => ++calls === 1 ? old.promise : current.promise,
    }, { subject: math, onLogout: () => logouts++ });
    const first = app.click('开始分析预测');
    app.update({ subject: physics });
    const second = app.click('开始分析预测');
    if (outcome === 'success') old.resolve({ analysis: { hotspots: { top5: ['stale-hotspot'] } } });
    else old.reject(Object.assign(new Error('stale-error'), { code: 'UNAUTHORIZED' }));
    await first; await app.settle();
    assert.equal(logouts, 0);
    assert.doesNotMatch(app.text(), /stale-hotspot|stale-error/);
    assert.match(app.text(), /AI 正在深度分析/);
    current.resolve({ analysis: { hotspots: { top5: ['current-hotspot'] } }, generatedAt: '2026-01-01' });
    await second; await app.settle();
    assert.match(app.text(), /current-hotspot/);
    app.update({ subject: math });
    assert.doesNotMatch(app.text(), /current-hotspot/);
  });
}
