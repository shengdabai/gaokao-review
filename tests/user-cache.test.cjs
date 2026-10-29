const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, mocks, globals = {}) {
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React },
  }).outputText;
  vm.runInNewContext(source, {
    module, exports: module.exports,
    require: name => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      throw new Error(`Unexpected import: ${name}`);
    },
    console: { error() {} }, ...globals,
  }, { filename: file });
  return module.exports;
}

// Deterministic hook/effect renderer for the real entry component. No browser,
// credentials, network, or copies of application cache logic are used here.
function webApp(apiOverrides = {}) {
  const values = new Map();
  const localStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
  const frames = new Map();
  let current, cursor, root, tree, dirty = false;
  const effects = [];
  const auth = {
    isLoggedIn: false, isLoading: false, user: null,
    login: async userId => { auth.user = { userId, username: userId }; auth.isLoggedIn = true; dirty = true; },
    logout: () => { auth.user = null; auth.isLoggedIn = false; dirty = true; },
  };
  const React = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    Fragment: 'fragment',
    useState(initial) {
      const frame = current, index = cursor++;
      if (!(index in frame.slots)) frame.slots[index] = typeof initial === 'function' ? initial() : initial;
      return [frame.slots[index], value => {
        if (!frame.active) return;
        frame.slots[index] = typeof value === 'function' ? value(frame.slots[index]) : value;
        dirty = true;
      }];
    },
    useRef(initial) {
      const index = cursor++;
      return current.slots[index] ??= { current: initial };
    },
    useEffect(effect, deps) {
      const frame = current, index = cursor++, prev = frame.slots[index];
      if (!prev || deps.some((value, i) => value !== prev.deps[i])) {
        effects.push(() => {
          prev?.cleanup?.();
          frame.slots[index] = { deps, cleanup: effect() };
        });
      }
    },
  };
  function render(element, location = 'root', seen = new Set()) {
    if (Array.isArray(element)) return element.map((child, i) => render(child, `${location}.${i}`, seen));
    if (!element || typeof element !== 'object') return element;
    if (typeof element.type === 'function') {
      const id = `${location}:${element.type.name}:${element.props.key ?? ''}`;
      const frame = frames.get(id) ?? { slots: [], active: true };
      frame.active = true;
      frames.set(id, frame);
      seen.add(id);
      current = frame;
      cursor = 0;
      return render(element.type(element.props), `${id}.child`, seen);
    }
    return { ...element, props: { ...element.props, children: render(element.props.children, `${location}.children`, seen) } };
  }
  function flush() {
    for (let iteration = 0; dirty; iteration++) {
      assert.ok(iteration < 20, 'render must settle');
      dirty = false;
      const seen = new Set();
      tree = render(root, 'root', seen);
      for (const [id, frame] of frames) {
        if (!seen.has(id)) {
          frame.active = false;
          frame.slots.forEach(slot => slot?.cleanup?.());
          frames.delete(id);
        }
      }
      effects.splice(0).forEach(effect => effect());
    }
  }
  const offline = async () => { throw new Error('fixture offline'); };
  const api = { getSearchHistory: offline, getMistakes: offline, searchNotes: async () => ({ content: 'fixture answer', source: 'ai' }), ...apiOverrides };
  load('index.tsx', {
    react: { ...React, default: React },
    'react-dom/client': { createRoot: () => ({ render: element => { root = element; dirty = true; } }) },
    'lucide-react': new Proxy({}, { get: (_, name) => String(name) }),
    './hooks/useAuth': { useAuth: () => auth },
    './components/AuthPage': { AuthPage: 'AuthPage' },
    './components/TutorChat': { TutorChat: 'TutorChat' },
    './components/PredictAnalysis': { PredictAnalysis: 'PredictAnalysis' },
    './components/StudyProgress': { StudyProgress: 'StudyProgress' },
    './constants/subjects': { SUBJECTS: [{ id: 'math', name: '数学', color: 'bg-blue-500' }] },
    './services/api': api,
  }, { localStorage, document: { getElementById: () => ({}) }, alert() {}, confirm: () => true });
  function nodes(element) {
    if (arguments.length === 0) element = tree;
    if (Array.isArray(element)) return element.flatMap(child => nodes(child));
    if (!element || typeof element !== 'object') return [];
    return [element, ...nodes(element.props.children)];
  }
  function text(element) {
    if (arguments.length === 0) element = tree;
    if (Array.isArray(element)) return element.map(child => text(child)).join('');
    if (!element || typeof element === 'boolean') return '';
    return typeof element === 'object' ? text(element.props.children) : String(element);
  }
  async function settle() {
    for (let i = 0; i < 8; i++) { await Promise.resolve(); flush(); }
  }
  flush();
  return {
    values, auth, flush, settle, nodes, text,
    async login(userId) { await auth.login(userId); await settle(); },
    async logout() { auth.logout(); await settle(); },
    click(label) {
      const button = nodes().find(node => node.type === 'button' && (text(node).includes(label) || node.props.title === label));
      assert.ok(button, `button ${label} exists`);
      button.props.onClick(); flush();
    },
  };
}

const mistake = label => ({ id: label, subject: 'math', image: '', analysis: label, tags: [], date: 'fixture-date' });

test('web: A cache survives re-login, while logout + B login exposes neither A nor legacy data', async () => {
  const app = webApp();
  app.values.set('app_search_history', JSON.stringify(['legacy-search']));
  app.values.set('app_error_notebook', JSON.stringify([mistake('legacy-mistake')]));
  app.values.set('app_search_history:A', JSON.stringify(['A-search']));
  app.values.set('app_error_notebook:A', JSON.stringify([mistake('A-mistake')]));
  await app.login('A');
  app.click('笔记搜索');
  assert.match(app.text(), /A-search/);
  app.click('错题本');
  assert.match(app.text(), /A-mistake/);
  await app.logout();
  assert.ok(app.nodes().some(node => node.type === 'AuthPage'));
  await app.login('B');
  app.click('笔记搜索');
  assert.doesNotMatch(app.text(), /A-search|legacy-search/);
  app.click('错题本');
  assert.doesNotMatch(app.text(), /A-mistake|legacy-mistake/);
  await app.logout();
  await app.login('A');
  app.click('笔记搜索');
  assert.match(app.text(), /A-search/);
  app.click('错题本');
  assert.match(app.text(), /A-mistake/);
});

test('web: direct userId switch resets memory even when isLoggedIn stays true', async () => {
  const app = webApp();
  app.values.set('app_search_history:A', JSON.stringify(['A-search']));
  await app.login('A');
  app.click('笔记搜索');
  assert.match(app.text(), /A-search/);
  await app.login('B');
  app.click('笔记搜索');
  assert.doesNotMatch(app.text(), /A-search/);
});

test('web: pending A loads cannot populate B state after account switch', async () => {
  let resolveHistory, resolveMistakes;
  const app = webApp({
    getSearchHistory: () => app.auth.user.userId === 'A' ? new Promise(resolve => { resolveHistory = resolve; }) : Promise.resolve({ items: [] }),
    getMistakes: () => app.auth.user?.userId === 'A' ? new Promise(resolve => { resolveMistakes = resolve; }) : Promise.resolve({ items: [] }),
  });
  await app.login('A');
  await app.logout();
  await app.login('B');
  resolveHistory({ items: [{ query: 'late-A-search' }] });
  await app.settle();
  resolveMistakes?.({ items: [{ ...mistake('late-A-mistake'), imageUrl: '', createdAt: '2026-01-01' }] });
  await app.settle();
  app.click('笔记搜索');
  assert.doesNotMatch(app.text(), /late-A/);
  app.click('错题本');
  assert.doesNotMatch(app.text(), /late-A/);
});

test('web: search writes and clearing affect only the signed-in user cache', async () => {
  const app = webApp();
  app.values.set('app_search_history:A', JSON.stringify(['A-search']));
  await app.login('B');
  app.click('笔记搜索');
  app.click('三角函数');
  await app.settle();
  assert.deepEqual(JSON.parse(app.values.get('app_search_history:B')), ['三角函数']);
  assert.deepEqual(JSON.parse(app.values.get('app_search_history:A')), ['A-search']);
  await app.logout();
  await app.login('B');
  app.click('笔记搜索');
  app.click('清空');
  assert.equal(app.values.has('app_search_history:B'), false);
  assert.equal(app.values.has('app_search_history:A'), true);
});

test('web: removing B notebook items only writes B cache', async () => {
  const app = webApp({ deleteMistake: async () => {} });
  app.values.set('app_error_notebook:A', JSON.stringify([mistake('A-mistake')]));
  app.values.set('app_error_notebook:B', JSON.stringify([mistake('B-mistake')]));
  await app.login('B');
  app.click('错题本');
  const remove = app.nodes().find(node => node.type === 'button' && app.nodes(node).some(child => child.type === 'Trash2'));
  assert.ok(remove);
  await remove.props.onClick();
  await app.settle();
  assert.deepEqual(JSON.parse(app.values.get('app_error_notebook:B')), []);
  assert.equal(JSON.parse(app.values.get('app_error_notebook:A'))[0].id, 'A-mistake');
});

function mobileStorage() {
  const databases = new Map(), opens = [];
  const storage = load('高考复习-mobile/services/storage.ts', {
    'expo-sqlite': {
      openDatabaseAsync: async name => {
        opens.push(name);
        if (!databases.has(name)) {
          const rows = new Map();
          let syncTime = null;
          databases.set(name, {
            async execAsync(sql) {
              if (sql === 'DELETE FROM mistakes_cache') rows.clear();
              if (sql === 'DELETE FROM sync_status') syncTime = null;
            },
            async runAsync(sql, args) {
              if (sql.startsWith('INSERT OR REPLACE INTO mistakes_cache')) {
                const [id, subject, image_data, analysis, tags, created_at, synced] = args;
                rows.set(id, { id, subject, image_data, analysis, tags, created_at, synced });
              } else if (sql.startsWith('UPDATE mistakes_cache')) {
                if (rows.has(args[0])) rows.get(args[0]).synced = 1;
              } else if (sql.startsWith('DELETE FROM mistakes_cache')) rows.delete(args[0]);
              else if (sql.includes('INSERT OR REPLACE INTO sync_status')) syncTime = args[0];
              else throw new Error(`Unexpected SQL: ${sql}`);
            },
            async getAllAsync(sql) { return [...rows.values()].filter(row => !sql.includes('synced = 0') || row.synced === 0); },
            async getFirstAsync() { return syncTime ? { value: syncTime } : null; },
          });
        }
        return databases.get(name);
      },
    },
  });
  return { storage, opens };
}

const mobileMistake = id => ({ id, subject: 'math', imageUrl: 'fixture-image', analysis: `analysis-${id}`, tags: [], createdAt: '2026-01-01' });

test('mobile: A/B offline notebooks and sync times stay isolated, including re-login and clearing', async () => {
  const { storage, opens } = mobileStorage();
  // The same mistake id can exist in both account caches without overwriting.
  await storage.saveMistakeLocally('A', mobileMistake('same-id'));
  await storage.setLastSyncTime('A', 'A-time');
  assert.equal((await storage.getLocalMistakes('B')).length, 0);
  assert.equal((await storage.getUnsyncedMistakes('B')).length, 0);
  assert.equal(await storage.getLastSyncTime('B'), null);
  await storage.saveMistakeLocally('B', { ...mobileMistake('same-id'), analysis: 'B-only' });
  await storage.setLastSyncTime('B', 'B-time');
  await storage.markMistakeSynced('B', 'same-id');
  assert.equal((await storage.getUnsyncedMistakes('A')).length, 1);
  assert.equal((await storage.getUnsyncedMistakes('B')).length, 0);
  await storage.deleteLocalMistake('B', 'same-id');
  assert.equal((await storage.getLocalMistakes('A'))[0].analysis, 'analysis-same-id');
  assert.equal(await storage.getLastSyncTime('A'), 'A-time');
  await storage.clearAllLocalData('B');
  assert.equal(await storage.getLastSyncTime('B'), null);
  assert.equal(await storage.getLastSyncTime('A'), 'A-time');
  assert.equal((await storage.getLocalMistakes('A')).length, 1);
  assert.equal(opens.includes('gaokao_cache.db'), false, 'legacy DB must never be opened/migrated');
  assert.equal(new Set(opens).size, 2);
});

test('mobile: missing owner is rejected before opening a cache', async () => {
  const { storage, opens } = mobileStorage();
  await assert.rejects(storage.getLocalMistakes(''));
  await assert.rejects(storage.getLocalMistakes(undefined));
  assert.equal(opens.length, 0);
});

test('mobile: concurrent initialization and encoded user IDs keep separate caches', async () => {
  const { storage, opens } = mobileStorage();
  await Promise.all([
    storage.saveMistakeLocally('user/a', mobileMistake('slash')),
    storage.saveMistakeLocally('user%2Fa', mobileMistake('percent')),
    storage.getLastSyncTime('user/a'),
  ]);
  assert.equal((await storage.getLocalMistakes('user/a'))[0].id, 'slash');
  assert.equal((await storage.getLocalMistakes('user%2Fa'))[0].id, 'percent');
  assert.equal(opens.length, 2, 'only one initialization per account');
  assert.ok(opens.every(name => !name.includes('/')));
});

function mobileProfile(storageOverrides = {}, apiOverrides = {}) {
  const slots = [], effects = [], alerts = [], calls = [];
  let cursor = 0, tree;
  const React = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], value => { slots[index] = value; }];
    },
    useRef(initial) { return slots[cursor++] ??= { current: initial }; },
    useEffect(effect) {
      const index = cursor++;
      if (!(index in slots)) { slots[index] = {}; effects.push(() => { slots[index].cleanup = effect(); }); }
    },
  };
  const storage = {};
  for (const [name, result] of Object.entries({
    getUnsyncedMistakes: [mobileMistake('A-local')], getLastSyncTime: 'A-time',
    saveMistakeLocally: undefined, markMistakeSynced: undefined,
    setLastSyncTime: undefined, clearAllLocalData: undefined,
  })) {
    storage[name] = async (...args) => { calls.push([name, ...args]); return result; };
  }
  Object.assign(storage, storageOverrides);
  const Profile = load('高考复习-mobile/app/(tabs)/profile.tsx', {
    react: { ...React, default: React },
    'react-native': {
      View: 'View', Text: 'Text', TouchableOpacity: 'TouchableOpacity', ScrollView: 'ScrollView',
      StyleSheet: { create: styles => styles }, Alert: { alert: (...args) => alerts.push(args) },
    },
    'expo-router': { router: { replace: route => calls.push(['replace', route]) } },
    '@/services/api': {
      getCurrentUser: async () => ({ userId: 'A', username: 'fixture-A' }),
      clearToken: async () => { calls.push(['clearToken']); },
      syncMistakes: async (...args) => {
        calls.push(['syncMistakes', ...args]);
        return { serverMistakes: [mobileMistake('server')], syncResults: [{ id: 'A-local', status: 'created' }], syncTime: 'new-time' };
      }, ...apiOverrides,
    },
    '@/services/storage': storage,
  }).default;
  function render() { cursor = 0; tree = Profile(); effects.splice(0).forEach(effect => effect()); }
  function text(node) {
    if (Array.isArray(node)) return node.map(text).join('');
    return node && typeof node === 'object' ? text(node.props.children) : String(node ?? '');
  }
  function nodes(node) {
    if (Array.isArray(node)) return node.flatMap(nodes);
    return node && typeof node === 'object' ? [node, ...nodes(node.props.children)] : [];
  }
  render();
  return {
    calls, alerts,
    async settle() { for (let i = 0; i < 8; i++) await Promise.resolve(); render(); },
    text: () => text(tree),
    click(label) {
      render();
      const button = nodes(tree).find(node => node.type === 'TouchableOpacity' && text(node).includes(label));
      assert.ok(button, `mobile button ${label} exists`);
      return button.props.onPress();
    },
    async confirm(label) {
      const action = alerts.flatMap(args => args[2] ?? []).find(button => button.text === label);
      assert.ok(action, `confirmation ${label} exists`);
      await action.onPress();
      render();
    },
    unmount() { slots.forEach(slot => slot?.cleanup?.()); },
  };
}

test('mobile profile: sync and clear actions pass the loaded userId to every cache operation', async () => {
  const profile = mobileProfile();
  await profile.settle();
  await profile.click('同步数据');
  profile.click('清除缓存');
  await profile.confirm('清除');
  for (const method of ['getUnsyncedMistakes', 'getLastSyncTime', 'saveMistakeLocally', 'markMistakeSynced', 'setLastSyncTime', 'clearAllLocalData']) {
    const call = profile.calls.find(entry => entry[0] === method);
    assert.ok(call, `${method} called`);
    assert.equal(call[1], 'A', `${method} must use signed-in user's ID`);
  }
  profile.unmount();
});

test('mobile profile: logout clears account memory and stops pending local cache from being synced', async () => {
  let releaseCache;
  const profile = mobileProfile({ getUnsyncedMistakes: () => new Promise(resolve => { releaseCache = resolve; }) });
  await profile.settle();
  const syncing = profile.click('同步数据');
  profile.click('退出登录');
  await profile.confirm('退出');
  assert.doesNotMatch(profile.text(), /fixture-A/);
  releaseCache([mobileMistake('A-local')]);
  await syncing;
  assert.equal(profile.calls.some(call => call[0] === 'syncMistakes'), false);
  profile.unmount();
});

test('mobile profile: missing identity blocks local cache operations', async () => {
  const profile = mobileProfile({}, { getCurrentUser: () => new Promise(() => {}) });
  await profile.click('同步数据');
  profile.click('清除缓存');
  assert.equal(profile.calls.length, 0);
  profile.unmount();
});

test('mobile profile: delayed clear confirmation cannot clear a cache after logout', async () => {
  const profile = mobileProfile();
  await profile.settle();
  profile.click('清除缓存');
  profile.click('退出登录');
  await profile.confirm('退出');
  await profile.confirm('清除');
  assert.equal(profile.calls.some(call => call[0] === 'clearAllLocalData'), false);
  profile.unmount();
});
