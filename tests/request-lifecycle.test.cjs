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
function renderModule(file, exported, api, initialProps = {}, imports = {}) {
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
      if (Object.hasOwn(imports, name)) return imports[name];
      if (name === 'react') return { ...react, default: react };
      if (name === '../services/api' || name === '@/services/api') return api;
      if (name === 'lucide-react') return new Proxy({}, { get: (_, key) => String(key) });
      throw new Error(`Unexpected import: ${name}`);
    },
    document: { addEventListener() {}, removeEventListener() {} },
    window: {
      addEventListener: (type, handler) => listeners.set(type, handler),
      removeEventListener: type => listeners.delete(type),
    },
    console: { error() {} },
    // Scrolling timers do not affect chat state; keep them off the event loop.
    setTimeout() { return 0; }, clearTimeout() {},
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
      const button = nodes().find(n => ['button', 'TouchableOpacity'].includes(n.type) && (text(n).includes(label) || n.props.title === label));
      assert.ok(button, `button ${label} exists`);
      const pending = (button.props.onClick || button.props.onPress)(); flush(); return pending;
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

function tutorFixture(platform, chatWithTutor) {
  const calls = { clears: 0, redirects: 0 };
  const api = { chatWithTutor, clearToken: async () => { calls.clears++; } };
  const app = platform === 'web'
    ? renderModule('components/TutorChat.tsx', 'TutorChat', api, { subject: math })
    : renderModule('高考复习-mobile/app/(tabs)/tutor.tsx', 'default', api, {}, {
      'react-native': {
        ...Object.fromEntries(['View', 'Text', 'TextInput', 'TouchableOpacity', 'ScrollView',
          'KeyboardAvoidingView', 'ActivityIndicator'].map(name => [name, name])),
        StyleSheet: { create: styles => styles }, Platform: { OS: 'android' },
      },
      'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
      'expo-router': { router: { replace() { calls.redirects++; } } },
      '@/constants/api': { SUBJECTS: [math, physics] },
    });
  return {
    app, calls,
    send(text) {
      const input = app.nodes().find(n => n.props?.placeholder?.startsWith('输入你的问题'));
      assert.ok(input);
      assert.notEqual(input.props.disabled, true);
      assert.notEqual(input.props.editable, false);
      if (platform === 'web') input.props.onChange({ target: { value: text } });
      else input.props.onChangeText(text);
      app.flush();
      const button = app.nodes().find(n => platform === 'web'
        ? n.type === 'button' && app.nodes(n).some(child => child.type === 'Send')
        : n.type === 'TouchableOpacity' && app.text(n) === '➤');
      assert.ok(button, 'send button exists and is ready');
      assert.notEqual(button.props.disabled, true);
      const pending = (button.props.onClick || button.props.onPress)();
      app.flush();
      return pending;
    },
    reset(kind) {
      if (kind === 'subject') { app.click('数学'); app.click('物理'); }
      if (kind === 'mode') app.click('🎯');
      if (kind === 'new-chat') {
        const button = app.nodes().filter(n => n.type === 'TouchableOpacity' && app.text(n) === '🔄').at(-1);
        assert.ok(button);
        button.props.onPress(); app.flush();
      }
      if (kind === 'unmount') app.unmount();
    },
  };
}

for (const platform of ['web', 'mobile']) {
  test(`${platform} tutor: backend replacement session is used by the next message without losing history`, async () => {
    const requests = [];
    const fixture = tutorFixture(platform, async args => {
      requests.push(args);
      return { sessionId: requests.length === 1 ? 'initial-session' : 'replacement-session',
        response: `answer-${requests.length}` };
    });
    for (const text of ['first question', 'second question', 'third question']) {
      await fixture.send(text); await fixture.app.settle();
    }
    assert.deepEqual(requests.map(request => request.sessionId), [undefined, 'initial-session', 'replacement-session']);
    for (const text of ['first question', 'second question', 'third question', 'answer-1', 'answer-2', 'answer-3']) {
      assert.ok(fixture.app.text().includes(text), `${text} remains in the conversation`);
    }
  });
}

for (const reset of ['subject', 'mode', 'new-chat', 'unmount']) {
  for (const outcome of reset === 'unmount' ? ['unauthorized'] : ['success', 'error', 'unauthorized']) {
    test(`mobile tutor: ${reset} discards stale ${outcome} and preserves the current request`, async () => {
      const old = deferred(), current = deferred(), requests = [];
      const fixture = tutorFixture('mobile', args => {
        requests.push(args);
        if (requests.length === 1) return old.promise;
        if (requests.length === 2) return current.promise;
        return Promise.resolve({ sessionId: 'current-session', response: 'follow-up-answer' });
      });
      const first = fixture.send('old question');
      fixture.reset(reset);
      // A new conversation must be usable before the old request finishes.
      const second = reset === 'unmount' ? null : fixture.send('current question');
      if (outcome === 'success') old.resolve({ sessionId: 'stale-session', response: 'stale-answer' });
      else old.reject(Object.assign(new Error('stale-error'), { code: outcome === 'unauthorized' ? 'UNAUTHORIZED' : 'NETWORK_ERROR' }));
      await first; await fixture.app.settle();
      assert.doesNotMatch(fixture.app.text(), /stale-answer|stale-error/);
      assert.equal(fixture.calls.clears, 0);
      assert.equal(fixture.calls.redirects, 0);
      if (reset === 'unmount') return;
      assert.equal(requests[1].sessionId, undefined);
      assert.equal(requests[1].mode, reset === 'mode' ? 'quiz' : 'learn');
      assert.equal(requests[1].subject, reset === 'subject' ? 'physics' : 'math');
      assert.equal(fixture.app.nodes().find(n => n.type === 'TextInput' && n.props.multiline).props.editable, false,
        'old completion must not release the current loading state');
      current.resolve({ sessionId: 'current-session', response: 'current-answer' });
      await second; await fixture.app.settle();
      assert.match(fixture.app.text(), /current-answer/);
      await fixture.send('follow-up question'); await fixture.app.settle();
      assert.equal(requests[2].sessionId, 'current-session');
    });
  }
}

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
