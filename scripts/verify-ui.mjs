// End-to-end UI verification for dsh-delete-session.
//
// Drives the running DSH Web UI over CDP and checks the injection seams.
// It NEVER confirms a deletion: it opens the confirm dialog and cancels it.
//
// Regression coverage: the session-row menu, the view-options (grouping) menu
// and the workspace-row menu are all the same `Menu` portal under
// document.body. Injection must appear in the session-row menu only — never in
// the other two (the historical "delete entry leaks into every menu" bug).
//
// Usage:
//   1. Start dsh web with CDP enabled:
//        $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS='--remote-debugging-port=9222'
//   2. node scripts/verify-ui.mjs
//
// Exit code 0 = all checks passed, 1 = at least one check failed.

const CDP = process.env.DSH_CDP || 'http://127.0.0.1:9222'
const ITEM_ATTR = 'data-dsh-delete-session-item'
const MODAL_ATTR = 'data-dsh-delete-session-modal'

const PROBE = `(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = { checks: [] };
  const check = (name, ok, detail) => out.checks.push({ name, ok, detail });

  const openMenus = () => [...document.querySelectorAll('[role="menu"]')];
  const injectedCount = () => document.querySelectorAll('[${ITEM_ATTR}]').length;
  const itemTexts = (menu) => menu ? [...menu.querySelectorAll('[role="menuitem"]')].map(b => b.textContent.trim()) : [];

  async function openByAria(prefix) {
    const btn = [...document.querySelectorAll('button[aria-label]')]
      .find(b => (b.getAttribute('aria-label') || '').startsWith(prefix));
    if (!btn) return null;
    btn.click();
    await sleep(600);
    const menus = openMenus();
    return menus.length ? menus[menus.length - 1] : null;
  }

  async function closeAll() {
    for (let i = 0; i < 3; i++) {
      if (!openMenus().length) return;
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await sleep(350);
    }
  }

  // ---- cross-menu regression: other official menus must stay clean --------
  // Open a session-row menu first (primes any legacy click-cache state), then
  // open the two non-session menus: neither may carry the injected entry.
  let menu = await openByAria('视图选项');
  check('regress: 视图选项(分组方式)菜单无注入项', menu !== null && menu.querySelector('[${ITEM_ATTR}]') === null,
    menu ? itemTexts(menu).join(' | ') : 'menu not found');
  await closeAll();

  menu = await openByAria('工作区“');
  check('regress: 工作区行菜单无注入项', menu !== null && menu.querySelector('[${ITEM_ATTR}]') === null,
    menu ? itemTexts(menu).join(' | ') : 'menu not found');
  await closeAll();
  check('regress: 关闭全部菜单后注入项总数为 0', injectedCount() === 0, String(injectedCount()));

  // ---- locate a session row through the fiber seam -------------------------
  const rows = [...document.querySelectorAll('[role="treeitem"]')];
  let target = null;
  for (const el of rows) {
    const fk = Object.keys(el).find((k) => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'));
    if (!fk) continue;
    let f = el[fk], hops = 0;
    while (f && hops < 80) {
      const p = f.memoizedProps;
      if (p && p.node && typeof p.node.id === 'string' && typeof p.onRename === 'function') { target = { el, props: p }; break; }
      f = f.return; hops++;
    }
    if (target) break;
  }
  check('fiber: 从会话行取到 sessionId', target !== null, target ? target.props.node.id : 'no row resolved');
  if (!target) return JSON.stringify(out);

  const anchor = target.el.querySelector('button[aria-label]');
  check('row: 找到 ⋯ 按钮', anchor !== null, anchor ? anchor.getAttribute('aria-label') : 'none');
  if (!anchor) return JSON.stringify(out);

  // ---- open the official menu and look for the injected entry --------------
  anchor.click();
  await sleep(600);
  menu = document.querySelector('[role="menu"]');
  check('menu: 官方菜单已打开', menu !== null, menu ? 'ok' : 'no [role=menu]');
  const items = menu ? [...menu.querySelectorAll('[role="menuitem"]')].map((b) => b.textContent.trim()) : [];
  out.menuItems = items;
  check('inject: 菜单中出现「删除会话」', items.some((t) => t.includes('删除会话')), items.join(' | '));

  const injected = menu ? menu.querySelector('[' + '${ITEM_ATTR}' + ']') : null;
  check('inject: 注入项带标记属性', injected !== null, injected ? 'ok' : 'missing');
  check('inject: 注入项为红色危险样式', injected !== null && !!injected.style.color, injected ? injected.style.color : 'n/a');

  // ---- click it: the official menu must close and our dialog must open -----
  if (injected) {
    injected.click();
    await sleep(600);
    const menuAfter = document.querySelector('[role="menu"]');
    check('menu: 点击后官方菜单已收起', menuAfter === null, menuAfter ? 'still open' : 'closed');
    const modal = document.querySelector('[${MODAL_ATTR}]');
    check('modal: 确认弹窗出现', modal !== null, modal ? 'ok' : 'no modal host');
    const text = modal ? modal.textContent : '';
    out.modalText = text.slice(0, 200);
    check('modal: 文案包含会话标题', text.includes(String(target.props.node.title || '').slice(0, 8)), text.slice(0, 80));
    check('modal: 含「不可恢复」警示', text.includes('不可恢复'), text.slice(0, 120));
    const buttons = modal ? [...modal.querySelectorAll('button')].map((b) => b.textContent.trim()) : [];
    out.modalButtons = buttons;
    check('modal: 有取消与永久删除两个按钮', buttons.length === 2, buttons.join(' | '));

    // ---- cancel; never confirm --------------------------------------------
    const cancel = modal ? [...modal.querySelectorAll('button')].find((b) => b.textContent.trim() === '取消') : null;
    if (cancel) { cancel.click(); await sleep(400); }
    const modalAfter = document.querySelector('[${MODAL_ATTR}]');
    check('modal: 取消后弹窗关闭', cancel !== null && modalAfter !== null && modalAfter.textContent.trim() === '', 'ok');
  }

  // ---- reopen the non-session menu AFTER a session menu cycle --------------
  menu = await openByAria('视图选项');
  check('regress: 会话菜单用过之后，视图选项菜单仍无注入项', menu !== null && menu.querySelector('[${ITEM_ATTR}]') === null,
    menu ? itemTexts(menu).join(' | ') : 'menu not found');
  await closeAll();

  return JSON.stringify(out);
})()`

async function main() {
  const list = await (await fetch(`${CDP}/json`)).json()
  const page = list.find((t) => t.type === 'page' && typeof t.url === 'string' && t.url.startsWith('http://127.0.0.1:3080'))
  if (!page) throw new Error(`no dsh web page target on ${CDP} (found: ${list.map((t) => t.url).join(', ')})`)
  console.log(`target: ${page.url}`)

  const ws = new WebSocket(page.webSocketDebuggerUrl)
  let seq = 0
  const waiters = new Map()
  const send = (method, params) =>
    new Promise((resolve) => {
      const id = ++seq
      waiters.set(id, resolve)
      ws.send(JSON.stringify({ id, method, params }))
    })
  ws.addEventListener('message', (ev) => {
    let msg
    try { msg = JSON.parse(ev.data) } catch { return }
    const w = msg.id && waiters.get(msg.id)
    if (w) { waiters.delete(msg.id); w(msg) }
  })
  ws.addEventListener('error', (e) => { console.error('WS-ERROR:', e?.message ?? String(e)); process.exit(1) })

  ws.addEventListener('open', async () => {
    const r = await send('Runtime.evaluate', { expression: PROBE, returnByValue: true, awaitPromise: true })
    if (r.result?.exceptionDetails) {
      console.error('EVAL EXCEPTION:', JSON.stringify(r.result.exceptionDetails).slice(0, 900))
      ws.close(); process.exit(1)
    }
    let report
    try { report = JSON.parse(r.result?.result?.value ?? '{}') } catch { console.error('bad payload:', r.result?.result?.value); ws.close(); process.exit(1) }
    console.log('menu items:', report.menuItems?.join(' | '))
    console.log('modal text:', report.modalText)
    console.log('modal buttons:', report.modalButtons?.join(' | '))
    console.log('')
    let failed = 0
    for (const c of report.checks ?? []) {
      if (!c.ok) failed += 1
      console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? '  → ' + c.detail : ''}`)
    }
    console.log(`\n${failed === 0 ? 'ALL CHECKS PASSED' : failed + ' CHECK(S) FAILED'}`)
    ws.close()
    process.exit(failed === 0 ? 0 : 1)
  })
}

main().catch((error) => { console.error('ERROR:', error.message); process.exit(1) })
