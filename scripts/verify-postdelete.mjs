// Offline regression test for the post-delete navigation seam of
// dsh-delete-session lib/client.js.
//
// Bug covered (fixed): after a confirmed deletion the plugin calls the
// official `uiWorkspace.startSession()` — host-verified as
// `target = workspaceId ?? currentWorkspaceId ?? recent`
// (dsh-client-ui-workspace lib/client.js). `currentWorkspaceId` is resolved
// through LIVE membership of `mainReference.sessionId`, but the host detaches
// the session from its workspace inside the delete reconcile BEFORE the HTTP
// 200 is written, and never clears `mainReference` for a REMOVED session — so
// a parameterless call after the response lands on `recentWorkspace(...)`,
// an unrelated workspace, every time. The fix captures the workspaceId before
// the request and passes it explicitly (as every official caller does).
//
// This test drives the REAL bundle: lib/client.js is loaded as-is (one
// instrumentation-only suffix on the exports line) and executed against
// stubbed host services, a stubbed React/ReactDOM, a stubbed DOM and a
// stubbed fetch. The confirm dialog's own confirm button is clicked, so the
// whole capture → request → leave chain runs unmodified. Nothing is deleted
// and no network call is made.

import { readFileSync } from 'node:fs'

const CLIENT = new URL('../lib/client.js', import.meta.url)

// ------------------------------------------------------------------ checks

const results = []
const check = (name, ok, detail) => {
  results.push({ name, ok, detail })
  if (!ok) process.exitCode = 1
}

// ------------------------------------------------------------------- stubs

const fakeElement = (tagName) => ({
  tagName,
  style: {},
  attributes: {},
  children: [],
  listeners: {},
  setAttribute(key, value) { this.attributes[key] = value },
  appendChild(child) { this.children.push(child); return child },
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn) },
  removeEventListener() {},
  querySelector() { return null },
  querySelectorAll() { return [] },
  contains() { return false },
  click() {},
})

const bodyElement = fakeElement('body')

const documentStub = {
  body: bodyElement,
  documentElement: { lang: 'zh-CN' },
  contains: () => true,
  querySelectorAll: () => [],
  querySelector: () => null,
  createElement: (tag) => fakeElement(tag),
  createElementNS: (ns, tag) => fakeElement(tag),
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => true,
}

const navigatorStub = { language: 'zh-CN' }

class MutationObserverStub {
  constructor(cb) { this.cb = cb }
  observe() {}
  disconnect() {}
}

// ---- React / ReactDOM stubs -------------------------------------------------

let hookIndex = 0
const hookStates = []
const hookRefs = []
let lastTree = null

const ReactStub = {
  createElement(type, props, ...children) {
    return {
      __el: true,
      type,
      props: {
        ...(props || {}),
        children: children.length === 0 ? undefined : children.length === 1 ? children[0] : children,
      },
    }
  },
  useState(init) {
    const i = hookIndex
    hookIndex += 1
    if (!(i in hookStates)) hookStates[i] = typeof init === 'function' ? init() : init
    return [hookStates[i], (value) => { hookStates[i] = typeof value === 'function' ? value(hookStates[i]) : value }]
  },
  useRef(init) {
    const i = hookIndex
    hookIndex += 1
    hookRefs[i] ||= { current: init }
    return hookRefs[i]
  },
  useEffect(fn) {
    const i = hookIndex
    hookIndex += 1
    return fn()
  },
}

const ReactDOMClientStub = {
  createRoot() {
    return {
      render(node) {
        lastTree = node === null || node === undefined ? null : renderNode(node)
      },
      unmount() { lastTree = null },
    }
  },
}

function renderNode(node) {
  if (node === null || node === undefined) return null
  if (typeof node !== 'object') return node
  if (typeof node.type === 'function') {
    // Fresh mount semantics: every renderNode of a function component resets
    // the hook cursor, so each dialog render starts from busy=false like a
    // real initial mount (the busy transition itself is not under test).
    hookIndex = 0
    hookStates.length = 0
    hookRefs.length = 0
    return renderNode(node.type(node.props))
  }
  return node
}

function findButton(tree, predicate) {
  if (tree === null || typeof tree !== 'object') return null
  if (tree.type === 'button' && predicate(tree)) return tree
  const children = tree.props && tree.props.children
  const list = Array.isArray(children) ? children : children === undefined ? [] : [children]
  for (const child of list) {
    const hit = findButton(child, predicate)
    if (hit !== null) return hit
  }
  return null
}

// ------------------------------------------------------------- load bundle

const source = readFileSync(CLIENT, 'utf8')
// Instrumentation-only suffix on the single exports line: exposes the
// internal closures this test needs to drive. The anchor is asserted below
// so a future edit that moves it fails loudly instead of silently testing
// nothing.
const ANCHOR = 'exports.apply = apply'
if (!source.includes(ANCHOR)) {
  console.error('FATAL: instrumentation anchor missing — update this test against the current bundle.')
  process.exit(1)
}
const instrumented = source.replace(
  ANCHOR,
  `${ANCHOR}; exports.__test = { openConfirm, sessionWorkspaceId: typeof sessionWorkspaceId === 'function' ? sessionWorkspaceId : undefined, leaveDeletedSession, closeConfirm }; globalThis.__dshdsExports = exports`,
)

let loadedFactory = null
const requireStub = (id) => {
  if (id === 'react') return ReactStub
  if (id === 'react-dom/client') return ReactDOMClientStub
  throw new Error(`unexpected require: ${id}`)
}

const windowStub = {
  __ModuleLoader__: {
    load: (mod) => {
      loadedFactory = () => mod.factory(requireStub)
    },
  },
}

const fetchStub = () =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ ok: true, value: { deleted: true, workspaceDetached: true } }),
  })

new Function('window', 'document', 'navigator', 'MutationObserver', 'fetch', instrumented)(
  windowStub,
  documentStub,
  navigatorStub,
  MutationObserverStub,
  fetchStub,
)
if (loadedFactory === null) {
  console.error('FATAL: bundle did not register with __ModuleLoader__')
  process.exit(1)
}
loadedFactory()
const bundleExports = globalThis.__dshdsExports
check('bundle: client bundle loaded and exposes apply', typeof bundleExports?.apply === 'function', '')

// ------------------------------------------------------------ fake ui host

// Two workspaces: ws-alpha owns sess-1/sess-2, ws-beta owns sess-9. The
// simulateDetached flag models the host reconcile having already landed in
// the client snapshot (session gone from every workspace's sessionIds).
const state = {
  simulateDetached: false,
  mainSessionId: 'sess-1',
  uiWorkspace: null,
}

const startSessionCalls = []

const buildUiWorkspace = () => ({
  workspaces: {
    list: {
      getSnapshot: () => {
        const alpha = state.simulateDetached ? ['sess-2'] : ['sess-1', 'sess-2']
        return {
          phase: 'ready',
          items: [
            { workspaceId: 'ws-alpha', path: 'E:\\alpha', sessionIds: alpha },
            { workspaceId: 'ws-beta', path: 'E:\\beta', sessionIds: ['sess-9'] },
          ],
        }
      },
    },
  },
  get mainReference() {
    return state.mainSessionId === null ? undefined : { sessionId: state.mainSessionId }
  },
  startSession: (workspaceId) => {
    startSessionCalls.push(workspaceId)
  },
})

const services = { uiWorkspace: buildUiWorkspace() }
const hostContext = {
  get: (name) => (name in services ? services[name] : null),
  effect: (fn) => { const dispose = fn(); return typeof dispose === 'function' ? dispose : () => {} },
  on: () => () => {},
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

const openDialogAndConfirm = async (target) => {
  bundleExports.__test.openConfirm(target)
  const confirm = findButton(lastTree, (node) => node.props.children === '永久删除')
  if (confirm === null) throw new Error('confirm button not found in rendered dialog tree')
  confirm.props.onClick()
  await flush()
  await flush()
}

const resetCalls = () => { startSessionCalls.length = 0 }

// ------------------------------------------------------------------- cases

bundleExports.apply(hostContext)

// T1 — happy path: the deleted session is attached to ws-alpha when the
// capture runs, so startSession must be called with 'ws-alpha' (the
// parameterless regression would pass undefined here).
{
  resetCalls()
  state.mainSessionId = 'sess-1'
  state.simulateDetached = false
  await openDialogAndConfirm({ sessionId: 'sess-1', title: 'Alpha chat' })
  check('T1: startSession 收到被删会话的工作区', startSessionCalls.length === 1 && startSessionCalls[0] === 'ws-alpha',
    `calls=${JSON.stringify(startSessionCalls)}`)
}

// T2 — reconcile race: by the time startSession resolves its target the host
// detach has already landed in the client snapshot (membership gone), exactly
// the production ordering (host detaches inside the reconcile, before the
// HTTP 200; leaveDeletedSession runs after it). The captured id must still
// win — a parameterless startSession would resolve `recent` here instead.
{
  resetCalls()
  state.mainSessionId = 'sess-1'
  state.simulateDetached = false
  bundleExports.__test.openConfirm({ sessionId: 'sess-1', title: 'Alpha chat' })
  const confirm = findButton(lastTree, (node) => node.props.children === '永久删除')
  confirm.props.onClick()
  // Synchronous phase done (workspace already captured); the detach lands in
  // the client snapshot before the awaited response settles.
  state.simulateDetached = true
  await flush()
  await flush()
  check('T2: detach 同步到达后仍落在原工作区', startSessionCalls.length === 1 && startSessionCalls[0] === 'ws-alpha',
    `calls=${JSON.stringify(startSessionCalls)}`)
}

// T3 — gate: a session that is NOT the one open in the main column must not
// move the main view at all.
{
  resetCalls()
  state.mainSessionId = 'sess-9'
  state.simulateDetached = false
  await openDialogAndConfirm({ sessionId: 'sess-1', title: 'Alpha chat' })
  check('T3: 非主视图会话删除不触发导航', startSessionCalls.length === 0,
    `calls=${JSON.stringify(startSessionCalls)}`)
}

// T4 — fail-soft: a host without the navigation service must not turn a
// successful deletion into an error.
{
  resetCalls()
  const saved = services.uiWorkspace
  delete services.uiWorkspace
  state.mainSessionId = 'sess-1'
  state.simulateDetached = false
  let threw = null
  try {
    await openDialogAndConfirm({ sessionId: 'sess-1', title: 'Alpha chat' })
  } catch (error) {
    threw = error
  }
  services.uiWorkspace = saved
  check('T4: 缺导航服务时删除不报错且不导航', threw === null && startSessionCalls.length === 0,
    threw ? `threw: ${threw.message}` : `calls=${JSON.stringify(startSessionCalls)}`)
}

// T5 — degenerate accounting: a session no workspace owns still degrades to
// the official parameterless behaviour instead of failing.
{
  resetCalls()
  state.mainSessionId = 'sess-unowned'
  state.simulateDetached = false
  await openDialogAndConfirm({ sessionId: 'sess-unowned', title: 'Orphan' })
  check('T5: 无工作区会话退化为官方无参行为',
    startSessionCalls.length === 1 && startSessionCalls[0] === undefined,
    `calls=${JSON.stringify(startSessionCalls)}`)
}

// ------------------------------------------------------------------ report

let failed = 0
for (const r of results) {
  if (!r.ok) failed += 1
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? '  → ' + r.detail : ''}`)
}
console.log(`\n${failed === 0 ? 'ALL CHECKS PASSED' : failed + ' CHECK(S) FAILED'}`)
process.exit(failed === 0 ? 0 : 1)
