// dsh-delete-session — Web client bundle.
//
// Adds one "delete session" entry to the official sidebar session row menu
// (rename / fork / archive) WITHOUT replacing the official ui-workspace row:
// the official bundle keeps rendering the menu, and this bundle appends one
// item into the already-open menu popup and wires it to this plugin's own
// Host route.
//
// Two DOM-level seams are used (both verified live against the running Web UI
// before this file was written):
//   1. Ownership: the session-row menu, the view-options (grouping) menu and
//      the workspace-row menu are all the same `Menu` portal component sharing
//      one `[role="menu"]` DOM under document.body, so DOM structure alone
//      cannot tell them apart. The open menu element's React fiber chain still
//      reaches its owner, and only a SessionNodeItem owner (memoizedProps
//      carrying `node.id` plus the row's rename callback) is eligible for
//      injection. The session id and title are resolved from those same props
//      at injection time: there is no cached "last clicked row" state that
//      could go stale and act on the wrong session.
//   2. Styling: class names carry a build hash (`_item_1nxmc_92`), so this
//      bundle copies class names from a live official item instead of
//      hardcoding them.
//
// If the ownership seam is missing (a future official UI change), the entry is
// simply never injected — this bundle never falls back to guessing a session id.
//
// Localisation follows the host locale service when it is present and falls
// back to a built-in zh/en table selected from `<html lang>` when it is not.
//
// Post-delete navigation: the official client clears the main column only for
// an ARCHIVED current session (dsh-client-ui-workspace `clearArchivedCurrent`
// and the explicit `clearMain()` inside `archiveSession`, verified on
// 0.1.7-rc.1/rc.2). A permanently REMOVED session has no such path: the
// sidebar row disappears, the resident Session keeps a `removed` flag whose
// only UI effect is a disabled input, and the window stays on the dead
// conversation. 0.1.5 did not behave this way — its list-authoritative
// `current` (`selected ∈ list ? selected : undefined`) dropped the deleted id
// on its own. To restore that landing, a confirmed deletion asks the host's
// own navigation service (`uiWorkspace`) to leave the session when it is the
// open one, through the same `startSession()` entry the 新建会话 button uses.
// Every step is feature-detected and fail-soft (see leaveDeletedSession).
//
// Keyboard shortcut: dsh 0.1.7-rc.2 added a host shortcut service
// (`dsh-client-shortcuts`, `ctx.shortcuts.register`) with a user-editable
// catalog (rebind / unbind / reset in the host's shortcut Settings). The
// delete action is registered there as `session.delete` with Ctrl+Shift+D —
// admitted on every supported shell (desktop bindings are unconstrained;
// web:windows/macos admit a primary+shift pair, `isWebBindingAllowed`), not
// on the reserved list and not taken by any shipped command. The shortcut
// acts on the session currently open in the main column, exactly what the
// official rename / fork / archive shortcuts act on
// (`dsh-client-ui-workspace` shortcuts.js `current()`: the row whose
// `retainedBy.mainView` count is positive), and runs the identical confirm →
// delete → leave flow the row-menu entry runs. Because this plugin's apply
// may run before the shortcut service is provided, arming is order-
// independent: apply-time attempt, cordis `internal/service` event, and a
// first-injection retry (see apply()).

window.__ModuleLoader__.load({
  id: 'dsh-delete-session',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports

    var React = require('react')
    var ReactDOMClient = require('react-dom/client')

    var ROUTE = '/plugins/dsh-delete-session/delete'
    var CONFIRM_HEADER = 'x-dsh-session-delete-confirmation'
    var CONFIRM_VALUE = 'delete-session'
    var ITEM_ATTR = 'data-dsh-delete-session-item'
    var LABEL_ATTR = 'data-dsh-delete-session-label'
    var MODAL_ATTR = 'data-dsh-delete-session-modal'
    var FIBER_PREFIXES = ['__reactFiber$', '__reactInternalInstance$']
    // Official IconTrashOutline16 geometry, lifted from the shipped frontend
    // bundle (the dsh-client-ui-primitives icon set: 16x16 viewBox, fill="none"
    // on the svg, one path painted with currentColor). Using the native glyph
    // keeps this entry visually identical to the rename / fork / archive icons
    // instead of standing out as a foreign 24x24 Material shape.
    var SVG_NS = 'http://www.w3.org/2000/svg'
    var TRASH_PATH = 'M14.4782 4.84067L14.2138 10.1152C14.1102 12.1872 14.067 13.0115 13.3866 13.9607C13.1044 14.3546 12.7498 14.6912 12.3424 14.9535C11.8239 15.2872 11.2415 15.4316 10.5585 15.4998C9.88727 15.5668 9.04946 15.5656 7.99998 15.5656C6.95051 15.5656 6.1127 15.5668 5.44142 15.4998C4.75851 15.4316 4.17602 15.2872 3.65753 14.9535C3.25012 14.6912 2.89559 14.3546 2.61332 13.9607C1.93296 13.0115 1.88979 12.1872 1.78619 10.1152L1.52179 4.84067L2.89006 4.77277L3.15343 10.0463C3.26221 12.2218 3.32452 12.6015 3.72646 13.1624C3.90825 13.4161 4.13686 13.6334 4.39927 13.8023C4.66204 13.9714 5.00263 14.0792 5.57825 14.1367C6.16562 14.1953 6.92298 14.1963 7.99998 14.1963C9.07699 14.1963 9.83434 14.1953 10.4217 14.1367C10.9973 14.0792 11.3379 13.9714 11.6007 13.8023C11.8631 13.6334 12.0917 13.4161 12.2735 13.1624C12.6755 12.6015 12.7378 12.2218 12.8465 10.0463L13.1099 4.77277L14.4782 4.84067ZM5.43011 6.22849H6.7994V11.3909H5.43011V6.22849ZM9.20056 6.22849H10.5699V11.3909H9.20056V6.22849ZM8.53597 0.434431C9.17976 0.434431 9.6522 0.426926 10.0966 0.571258C10.2357 0.616451 10.3717 0.672554 10.502 0.738948C10.9182 0.951107 11.2464 1.29099 11.7015 1.74612L12.4978 2.54136H15.3742V3.91169H0.625732V2.54136H3.50218L4.29845 1.74612C4.75358 1.29099 5.08174 0.951107 5.49801 0.738948C5.62831 0.672554 5.76425 0.616451 5.90334 0.571258C6.34776 0.426926 6.82021 0.434431 7.46399 0.434431H8.53597ZM7.46399 1.80476C6.73208 1.80476 6.51641 1.81187 6.32617 1.87369C6.25545 1.89667 6.18668 1.92533 6.12041 1.95907C5.96398 2.03878 5.82348 2.16253 5.44142 2.54136H10.5585C10.1765 2.16253 10.036 2.03878 9.87955 1.95907C9.81329 1.92533 9.74452 1.89667 9.6738 1.87369C9.48356 1.81187 9.26789 1.80476 8.53597 1.80476H7.46399Z'

    // ---------------------------------------------------------------- locale
    //
    // The dictionary is registered under this plugin's OWN namespace: the host
    // registry throws when a (namespace, locale) pair is already taken
    // (dsh-client-locale/lib/client.js:1264), so sharing an official namespace
    // would break activation. `bind(ns)` returns a stable translator that reads
    // the active language on every call (same file, :1283-1291), and
    // `subscribe()` is the documented way for a non-React consumer to learn
    // about a language switch (:1129-1134).
    var NS = 'dsh-delete-session'
    var DICT = {
      zh: {
        'menu.delete': '删除会话',
        'dialog.title': '永久删除该会话？',
        'dialog.body': '会话“{title}”的对话记录、统计数据与磁盘文件将被永久删除，此操作不可恢复。',
        'dialog.cancel': '取消',
        'dialog.confirm': '永久删除',
        'dialog.deleting': '删除中…',
        'error.http': '删除失败（HTTP {status}）',
        'shortcut.noSession': '当前没有打开的会话',
      },
      en: {
        'menu.delete': 'Delete session',
        'dialog.title': 'Permanently delete this session?',
        'dialog.body':
          'The conversation, statistics and on-disk files of “{title}” will be permanently deleted. This cannot be undone.',
        'dialog.cancel': 'Cancel',
        'dialog.confirm': 'Delete permanently',
        'dialog.deleting': 'Deleting…',
        'error.http': 'Delete failed (HTTP {status})',
        'shortcut.noSession': 'No session is open',
      },
    }

    /** Bound host translator; null means "no locale service, use the table". */
    var localeT = null

    function interpolate(template, params) {
      if (!params) return template
      return template.replace(/\{(\w+)\}/g, function (match, name) {
        return Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match
      })
    }

    /**
     * Fallback used when the host locale service is absent. The locale plugin
     * writes `<html lang>` from the active locale (`zh-CN` / `en`), so it is a
     * reliable hint; anything non-Chinese resolves to English.
     */
    function fallbackTranslate(key, params) {
      var lang = 'en'
      try {
        var raw =
          (typeof document !== 'undefined' && document.documentElement && document.documentElement.lang) ||
          (typeof navigator !== 'undefined' && navigator.language) ||
          'en'
        if (String(raw).toLowerCase().indexOf('zh') === 0) lang = 'zh'
      } catch (error) {
        lang = 'en'
      }
      var table = DICT[lang] || DICT.en
      var template = table[key] !== undefined ? table[key] : DICT.en[key] !== undefined ? DICT.en[key] : key
      return interpolate(template, params)
    }

    function t(key, params) {
      if (localeT !== null) return localeT(key, params)
      return fallbackTranslate(key, params)
    }

    // ---------------------------------------------------------------- fibers

    /** The React fiber key React attaches to a DOM node (prefix is versioned). */
    function fiberKeyOf(element) {
      var keys = Object.keys(element)
      for (var i = 0; i < keys.length; i += 1) {
        for (var j = 0; j < FIBER_PREFIXES.length; j += 1) {
          if (keys[i].indexOf(FIBER_PREFIXES[j]) === 0) return keys[i]
        }
      }
      return null
    }

    // ----------------------------------------------------------------- menu

    /** The currently open menu popup, or null. Newest wins. */
    function findOpenMenu() {
      var menus = document.querySelectorAll('[role="menu"]')
      for (var i = menus.length - 1; i >= 0; i -= 1) {
        if (menus[i].querySelector('[role="menuitem"]')) return menus[i]
      }
      return null
    }

    /**
     * Resolve the owning SessionNodeItem props of an open menu through its
     * React fiber chain. All official menus are the same `Menu` portal sharing
     * one `[role="menu"]` DOM under document.body, but the portal's fiber
     * chain still reaches its owner (verified live: the session menu hits
     * SessionNodeItem at ~8 hops, while the view-options and workspace-row
     * menus never match). Identified by shape, not by component name: a props
     * object carrying `node` (with a string id) plus the row's rename callback
     * (`onRenameRequest` on 0.1.7+, `onRename` before) is unambiguous in this
     * tree. Returns null for menus that are not a session row's menu.
     * @returns {{node: {id: string, title?: string}}|null}
     */
    function menuSessionProps(menu) {
      var key = fiberKeyOf(menu)
      if (key === null) return null
      var fiber = menu[key]
      var hops = 0
      while (fiber && hops < 80) {
        var props = fiber.memoizedProps
        // DSH 0.1.7 renamed the row's rename callback: `onRename` became
        // `onRenameRequest` (signature (id, currentTitle)). Accept either so the
        // ownership check keeps matching across host lines — an unmatched shape
        // means this bundle silently injects nothing, which is exactly how the
        // entry disappeared on 0.1.7.
        if (
          props &&
          props.node &&
          typeof props.node.id === 'string' &&
          (typeof props.onRenameRequest === 'function' || typeof props.onRename === 'function')
        ) {
          return props
        }
        fiber = fiber.return
        hops += 1
      }
      return null
    }

    function trashIcon() {
      var svg = document.createElementNS(SVG_NS, 'svg')
      svg.setAttribute('width', '16')
      svg.setAttribute('height', '16')
      svg.setAttribute('viewBox', '0 0 16 16')
      svg.setAttribute('fill', 'none')
      svg.setAttribute('xmlns', SVG_NS)
      var path = document.createElementNS(SVG_NS, 'path')
      path.setAttribute('d', TRASH_PATH)
      path.setAttribute('fill', 'currentColor')
      svg.appendChild(path)
      return svg
    }

    /** Build a menu entry that copies the live official item's class names. */
    function buildMenuItem(menu, target) {
      var sample = menu.querySelector('button[role="menuitem"]')
      var sampleWrap = sample === null ? null : sample.parentElement
      var sampleSpans = sample === null ? [] : sample.querySelectorAll('span')

      var wrap = document.createElement('div')
      if (sampleWrap !== null) wrap.className = sampleWrap.className

      var button = document.createElement('button')
      button.type = 'button'
      button.setAttribute('role', 'menuitem')
      button.setAttribute(ITEM_ATTR, '1')
      if (sample !== null) button.className = sample.className

      var icon = document.createElement('span')
      if (sampleSpans[0]) icon.className = sampleSpans[0].className
      icon.appendChild(trashIcon())

      var label = document.createElement('span')
      if (sampleSpans[1]) label.className = sampleSpans[1].className
      label.setAttribute(LABEL_ATTR, '1')
      label.textContent = t('menu.delete')

      button.appendChild(icon)
      button.appendChild(label)
      // Mirror the official rows' shortcut keycaps when the host shortcut
      // service published a binding for our command: the wrapper, keys span
      // and every kbd are cloned from a live official item (only the texts
      // are rewritten), so the entry is visually identical to 重命名 /
      // 分叉会话 / 归档会话. A user-unbound command renders no keycaps —
      // exactly like an unbound official row.
      var shortcut = shortcutRow()
      if (shortcut !== null) {
        var liveKbd = menu.querySelector('button[role="menuitem"] kbd')
        var liveKeys = liveKbd === null ? null : liveKbd.parentElement
        var liveHost = liveKeys === null ? null : liveKeys.parentElement
        if (liveHost !== null) {
          var clone = liveHost.cloneNode(true)
          var kbds = clone.querySelectorAll('kbd')
          if (kbds.length === shortcut.keys.length) {
            for (var i = 0; i < kbds.length; i += 1) kbds[i].textContent = shortcut.keys[i]
            if (typeof shortcut.aria === 'string' && shortcut.aria !== '') {
              button.setAttribute('aria-keyshortcuts', shortcut.aria)
            }
            button.appendChild(clone)
          }
        }
      }
      button.style.color = 'var(--dsw-alias-state-error-primary, #ec1313)'
      button.addEventListener('click', function (event) {
        onDeleteItemClick(event, target)
      })

      wrap.appendChild(button)
      return wrap
    }

    // ---------------------------------------------------------------- state

    /** Set while our confirm dialog is open, to suppress re-injection. */
    var modalOpen = false

    function tryInject() {
      // Safety-net retry for the shortcut registration (see apply()): by the
      // time a session menu opens the host is fully booted, so the shortcut
      // service must be reachable now if it is reachable at all.
      if (shortcutState === 'pending') disposeShortcut = registerDeleteShortcut(hostContext)
      if (modalOpen) return
      var menu = findOpenMenu()
      if (menu === null) return
      if (menu.querySelector('[' + ITEM_ATTR + ']') !== null) return
      var props = menuSessionProps(menu)
      // Not a session row's menu (view options, workspace rows, …): inject
      // nothing. Before ownership checking this menu matched any open
      // [role="menu"] and a stale click-cache made other menus delete the
      // last-clicked session.
      if (props === null) return
      var title = typeof props.node.title === 'string' && props.node.title !== ''
        ? props.node.title
        : props.node.id
      var viewport = menu.querySelector('[role="presentation"]') || menu
      viewport.appendChild(buildMenuItem(menu, { sessionId: props.node.id, title: title }))
    }

    /**
     * Close the official menu through its own onClose callback: the open
     * `Menu` fiber sits on the menu element's fiber chain with `open: true`,
     * and its onClose is the owner's state setter path — the same callback an
     * official item click, Escape and outside-click all go through.
     */
    function closeOfficialMenu(menu) {
      var key = fiberKeyOf(menu)
      if (key === null) return
      var fiber = menu[key]
      var hops = 0
      while (fiber && hops < 80) {
        var props = fiber.memoizedProps
        if (props && props.open === true && typeof props.onClose === 'function') {
          props.onClose()
          return
        }
        fiber = fiber.return
        hops += 1
      }
    }

    function onDeleteItemClick(event, target) {
      event.preventDefault()
      event.stopPropagation()
      var menu = findOpenMenu()
      if (menu !== null) closeOfficialMenu(menu)
      openConfirm(target)
    }

    /**
     * Re-render our own texts after a language switch: relabel any injected
     * menu entry still mounted, and re-render an open dialog (its strings are
     * read through `t()` during render).
     */
    function repaintForLocale() {
      var labels = document.querySelectorAll('[' + LABEL_ATTR + ']')
      for (var i = 0; i < labels.length; i += 1) labels[i].textContent = t('menu.delete')
      if (modalOpen && root !== null && dialogTarget !== null) {
        root.render(React.createElement(ConfirmDialog, { target: dialogTarget, onDone: closeConfirm }))
      }
    }

    // ------------------------------------------------------------------ rpc

    function requestDelete(sessionId) {
      var headers = { 'content-type': 'application/json' }
      headers[CONFIRM_HEADER] = CONFIRM_VALUE
      return fetch(ROUTE, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ sessionId: sessionId }),
      }).then(function (response) {
        return response
          .json()
          .catch(function () {
            return null
          })
          .then(function (payload) {
            if (!response.ok || payload === null || payload.ok !== true) {
              var message =
                payload && payload.error && typeof payload.error.message === 'string'
                  ? payload.error.message
                  : t('error.http', { status: response.status })
              throw new Error(message)
            }
            return payload.value
          })
      })
    }

    // ---------------------------------------------------------------- modal

    var container = null
    var root = null
    /** The session the open confirm dialog acts on; null when closed. */
    var dialogTarget = null
    /** The client Context of the active plugin run; null once disposed. */
    var hostContext = null
    /**
     * Host shortcut command lifecycle: 'pending' (not registered yet) →
     * 'armed' (registered, disposeShortcut holds the disposer) or 'refused'
     * (registration threw; deterministic, no further attempts).
     */
    var shortcutState = 'pending'
    var disposeShortcut = null
    var unsubscribeService = null

    function ensureModalHost() {
      if (container !== null && document.contains(container)) return
      container = document.createElement('div')
      container.setAttribute(MODAL_ATTR, '1')
      document.body.appendChild(container)
      root = ReactDOMClient.createRoot(container)
    }

    function closeConfirm() {
      modalOpen = false
      dialogTarget = null
      if (root !== null) root.render(null)
    }

    function openConfirm(target) {
      ensureModalHost()
      modalOpen = true
      dialogTarget = target
      root.render(React.createElement(ConfirmDialog, { target: target, onDone: closeConfirm }))
    }

    /**
     * Move the main column off a just-deleted session when that session is the
     * one currently open.
     *
     * Host-verified contract (dsh-client-ui-workspace lib/client.js, both
     * 0.1.7-rc.1 and 0.1.7-rc.2): the official client releases the main view
     * for an ARCHIVED current session only — `clearArchivedCurrent()` in the
     * navigation reconcile plus the explicit `clearMain()` inside
     * `archiveSession()`. A removed session has no equivalent, which is why
     * the window stayed on the deleted conversation. `startSession()` with no
     * argument is the official 新建会话 entry: it opens a fresh session in the
     * deleted session's workspace, falls back to the most recent workspace,
     * and falls back to the empty state when no workspace exists — the same
     * landing 0.1.5 produced when its `current` dropped the deleted id.
     *
     * Fail-soft by design: the storage is already gone when this runs, so a
     * missing service, a renamed `mainReference` field or a failed navigation
     * must never surface as a delete error. The worst case is the previous
     * (stuck) behaviour, and the user can always click 新建会话 themselves.
     */
    function leaveDeletedSession(sessionId) {
      try {
        if (hostContext === null || typeof hostContext.get !== 'function') return
        var uiWorkspace = hostContext.get('uiWorkspace')
        if (uiWorkspace === null || uiWorkspace === undefined) return
        if (typeof uiWorkspace.startSession !== 'function') return
        var mainReference = uiWorkspace.mainReference
        if (mainReference === null || mainReference === undefined) return
        if (mainReference.sessionId !== sessionId) return
        uiWorkspace.startSession()
      } catch (error) {
        // Deletion already succeeded; a failed navigation stays silent.
      }
    }

    /**
     * The session currently open in the main column, or null when none is.
     *
     * Host-verified contract: the official rename / fork / archive shortcuts
     * resolve their target the same way — the session list row whose
     * `retainedBy.mainView` retention count is positive is the one the main
     * column is bound to (dsh-client-ui-workspace shortcuts.js `current()`;
     * the retention bookkeeping lives in dsh-api-session-controller
     * lib/client.js `retainedBy`). Reading the list through the `sessions`
     * service keeps this bundle free of ui-workspace private fields.
     *
     * Fail-soft: a missing service or a changed row shape resolves to null,
     * which surfaces as the host's "no session" blocked reason instead of an
     * exception inside the shortcut dispatcher.
     */
    function currentSessionTarget() {
      try {
        if (hostContext === null || typeof hostContext.get !== 'function') return null
        var sessions = hostContext.get('sessions')
        if (sessions === null || sessions === undefined) return null
        var list = sessions.list
        if (list === null || list === undefined || typeof list.getSnapshot !== 'function') return null
        var byId = list.getSnapshot().byId
        if (byId === null || byId === undefined) return null
        var rows = Object.keys(byId).map(function (key) {
          return byId[key]
        })
        for (var i = 0; i < rows.length; i += 1) {
          var row = rows[i]
          if (row === null || row === undefined) continue
          var retainedBy = row.retainedBy
          if (retainedBy === null || retainedBy === undefined) continue
          if ((retainedBy.mainView ?? 0) <= 0) continue
          if (typeof row.id !== 'string' || row.id === '') continue
          return {
            sessionId: row.id,
            title: typeof row.displayTitle === 'string' && row.displayTitle !== '' ? row.displayTitle : row.id,
          }
        }
        return null
      } catch (error) {
        return null
      }
    }

    /**
     * Register the `session.delete` host shortcut command (Ctrl+Shift+D).
     *
     * Host-verified contract (dsh 0.1.7-rc.2, dsh-client-shortcuts): the
     * command resolves to the session currently open in the main column —
     * the same target the official rename / fork / archive shortcuts act on —
     * and runs the identical confirm → delete → leave flow the row-menu entry
     * runs. The host dispatcher calls `resolve` on every matching key press,
     * so it stays side-effect free and defers to `run`. Ctrl+Shift+D is
     * admitted on every supported shell (desktop bindings are unconstrained;
     * web:windows/macos admit a primary+shift pair — `isWebBindingAllowed`),
     * is on no reserved list and is taken by no shipped command (a full-tree
     * scan for KeyD bindings found none), so a default cannot be refused.
     *
     * Lifecycle: only 'pending' state attempts registration; a success moves
     * to 'armed' and returns the disposer, a refusal moves to 'refused' and
     * warns once. A refused registration is deterministic (duplicate id,
     * reserved or conflicting default in a future host), so retrying cannot
     * help; the row-menu entry remains the surviving path either way.
     *
     * @param ctx - client Context providing the `shortcuts` service.
     * @returns the registration disposer when armed, otherwise null.
     */
    function registerDeleteShortcut(ctx) {
      if (shortcutState !== 'pending') return null
      if (ctx === null || ctx === undefined || typeof ctx.get !== 'function') return null
      var shortcuts = ctx.get('shortcuts')
      if (shortcuts === null || shortcuts === undefined || typeof shortcuts.register !== 'function') return null
      try {
        disposeShortcut = shortcuts.register({
          id: 'session.delete',
          label: function () {
            return t('menu.delete')
          },
          aliases: ['delete session', '删除会话'],
          defaults: {
            'desktop:macos': { code: 'KeyD', modifiers: ['primary', 'shift'] },
            'desktop:windows': { code: 'KeyD', modifiers: ['primary', 'shift'] },
            'desktop:linux': { code: 'KeyD', modifiers: ['primary', 'shift'] },
            'web:macos': { code: 'KeyD', modifiers: ['primary', 'shift'] },
            'web:windows': { code: 'KeyD', modifiers: ['primary', 'shift'] },
          },
          regions: ['page', 'editable'],
          modals: [],
          resolve: function () {
            // Our own confirm dialog is not a host modal, so the dispatcher
            // would still deliver the key press: guard against a second
            // dialog over the first one.
            if (modalOpen) return { status: 'blocked', reason: t('dialog.title') }
            var target = currentSessionTarget()
            if (target === null) return { status: 'blocked', reason: t('shortcut.noSession') }
            return {
              status: 'handled',
              run: function () {
                openConfirm(target)
              },
            }
          },
        })
        shortcutState = 'armed'
        return disposeShortcut
      } catch (error) {
        shortcutState = 'refused'
        console.warn('dsh-delete-session: Ctrl+Shift+D registration refused (', String(error), '); the row-menu entry still works')
        return null
      }
    }

    /**
     * The published binding for our `session.delete` command as displayed
     * keycaps, or null when the host has no shortcut service, no catalog, or
     * the command is unbound. Shape follows the host shortcut catalog row:
     * `keys` are the rendered keycap texts ('Ctrl', '+', 'Shift', '+', 'D' on
     * Windows; flat symbols on macOS) and `aria` is the accessible
     * combination. Users rebind or unbind the command in the host's shortcut
     * Settings (dsh-client-ui-shortcuts), so this is read fresh on every
     * menu injection rather than cached.
     */
    function shortcutRow() {
      try {
        if (hostContext === null || typeof hostContext.get !== 'function') return null
        var shortcuts = hostContext.get('shortcuts')
        if (shortcuts === null || shortcuts === undefined) return null
        var catalog = shortcuts.catalog
        if (catalog === null || catalog === undefined || typeof catalog.getSnapshot !== 'function') return null
        var rows = catalog.getSnapshot()
        if (!Array.isArray(rows)) return null
        for (var i = 0; i < rows.length; i += 1) {
          var row = rows[i]
          if (row === null || row === undefined || row.id !== 'session.delete') continue
          if (!Array.isArray(row.keys) || row.keys.length === 0) return null
          return { keys: row.keys, aria: row.aria }
        }
        return null
      } catch (error) {
        return null
      }
    }

    // Colors come from DSH's own theme variables. They are declared on <body>
    // and re-declared under `body[data-ds-dark-theme]`, so a single declaration
    // follows both themes. Verified live against the running UI:
    //   light: --dsw-alias-bg-layer-3 #fff         --dsw-alias-label-primary #0f1115
    //   dark:  --dsw-alias-bg-layer-3 bluish-800   --dsw-alias-label-primary bluish-50
    var overlayStyle = {
      position: 'fixed',
      inset: '0',
      background: 'var(--dsw-alias-bg-mask-1, rgba(0, 0, 0, 0.24))',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: '2147483000',
    }
    // Surface recipe taken from the host's own Modal dialog
    // (dsh-client-ui-primitives Modal.module.css `.dialog`): an OPAQUE layer-2
    // fill with the prominent elevation and the standard panel radius.
    //
    // This previously used `--dsw-specific-menu`, which on DSH 0.1.7 resolves to
    // `--dsw-menu-surface-fill: #f8f9fa94` — a 58%-opaque frosted fill meant to
    // sit behind `[data-menu-material]` + `backdrop-filter: blur(40px)`. This
    // panel has neither, so the frozen fill simply let the conversation show
    // through and the text washed out. layer-2 is opaque, re-declared for the
    // dark theme, and carries no material expectations.
    var panelStyle = {
      minWidth: '360px',
      maxWidth: '520px',
      background: 'var(--dsw-alias-bg-layer-2, var(--dsw-alias-bg-layer-3, #fff))',
      color: 'var(--dsw-alias-label-primary, #0f1115)',
      borderRadius: 'var(--dsw-radius-panel, 16px)',
      padding: '20px',
      boxShadow: 'var(--dsw-elevation-prominent, var(--dsw-elevation-panel, 0 0 0 0.5px rgba(0, 0, 0, 0.16), 0 3px 8px rgba(0, 0, 0, 0.03), 0 0 16px rgba(0, 0, 0, 0.02)))',
      fontFamily: 'var(--dsw-font-family, system-ui, -apple-system, "Segoe UI", sans-serif)',
      fontSize: '14px',
      lineHeight: '1.6',
    }
    var dangerButtonStyle = {
      padding: '7px 14px',
      borderRadius: '8px',
      border: '1px solid transparent',
      background: 'var(--dsw-alias-state-error-primary, #ec1313)',
      color: '#fff',
      cursor: 'pointer',
      font: 'inherit',
    }
    var plainButtonStyle = {
      padding: '7px 14px',
      borderRadius: '8px',
      border: '1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.1))',
      background: 'var(--dsw-alias-button-floating-fill, transparent)',
      color: 'inherit',
      cursor: 'pointer',
      font: 'inherit',
    }

    function ConfirmDialog(props) {
      var target = props.target
      var busyState = React.useState(false)
      var busy = busyState[0]
      var setBusy = busyState[1]
      var errorState = React.useState(null)
      var error = errorState[0]
      var setError = errorState[1]

      // Keyboard contract of the dialog: Enter confirms, Escape cancels —
      // the keyboard twin of the two footer buttons, so the Ctrl+Shift+D
      // entry is a complete keyboard flow (open → Enter → landing on the new
      // session) and a mouse-opened dialog behaves identically.
      //
      // The listener runs in the CAPTURE phase and consumes both keys. A
      // keydown that starts inside the chat editor would otherwise both send
      // a message (React handles it before any document-level bubble
      // listener runs) and reach this dialog. Keys landing on one of our own
      // footer buttons are left alone: the focused button activates natively
      // on Enter, and consuming it here would turn "Enter on 取消" into a
      // confirm. IME composition is respected like the host's own dialogs
      // (dsh-client-ui-workspace rename modal guards Enter with a composing
      // ref): a composing Enter must confirm text, not delete a session.
      var busyRef = React.useRef(false)
      busyRef.current = busy
      React.useEffect(function () {
        function onKey(event) {
          if (event.isComposing === true) return
          if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            props.onDone()
            return
          }
          if (event.key !== 'Enter') return
          var insideDialog = container !== null && container.contains(event.target)
          if (insideDialog) return
          event.preventDefault()
          event.stopPropagation()
          if (busyRef.current === true) return
          confirm()
        }
        document.addEventListener('keydown', onKey, true)
        return function () {
          document.removeEventListener('keydown', onKey, true)
        }
      }, [])

      function confirm() {
        setBusy(true)
        setError(null)
        requestDelete(target.sessionId)
          .then(function () {
            // Leave the deleted conversation when it is the open one, before
            // the dialog closes so the main column is already on the new
            // session by the time the dialog unmounts.
            leaveDeletedSession(target.sessionId)
            props.onDone()
          })
          .catch(function (failure) {
            setBusy(false)
            setError(failure && failure.message ? failure.message : String(failure))
          })
      }

      var children = [
        React.createElement(
          'div',
          { key: 'title', style: { fontSize: '16px', fontWeight: '600', marginBottom: '8px' } },
          t('dialog.title'),
        ),
        React.createElement(
          'div',
          { key: 'body', style: { opacity: '0.85' } },
          t('dialog.body', { title: target.title }),
        ),
      ]

      if (error !== null) {
        children.push(
          React.createElement(
            'div',
            {
              key: 'error',
              style: { marginTop: '12px', color: 'var(--dsw-alias-state-error-primary, #ec1313)', wordBreak: 'break-word' },
            },
            error,
          ),
        )
      }

      children.push(
        React.createElement(
          'div',
          { key: 'footer', style: { marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' } },
          React.createElement(
            'button',
            {
              type: 'button',
              style: plainButtonStyle,
              disabled: busy,
              onClick: function () {
                props.onDone()
              },
            },
            t('dialog.cancel'),
          ),
          React.createElement(
            'button',
            {
              type: 'button',
              style: dangerButtonStyle,
              disabled: busy,
              onClick: confirm,
            },
            busy ? t('dialog.deleting') : t('dialog.confirm'),
          ),
        ),
      )

      return React.createElement(
        'div',
        {
          style: overlayStyle,
          onMouseDown: function (event) {
            if (event.target === event.currentTarget && !busy) props.onDone()
          },
        },
        React.createElement('div', { style: panelStyle, role: 'dialog', 'aria-modal': 'true' }, children),
      )
    }

    // ------------------------------------------------------------------ app

    function apply(ctx) {
      ctx.effect(
        function () {
          // Retained for leaveDeletedSession(): the navigation service is
          // looked up lazily at delete-confirmation time, so plugin load
          // order against ui-workspace does not matter.
          hostContext = ctx
          // The locale service is looked up rather than injected: deletion must
          // keep working even in a composition that ships no locale face. When
          // it is present we register our own namespace and bind a translator;
          // a refused registration (namespace taken, service shape changed)
          // simply leaves the built-in table in place.
          var disposeDictionary = null
          var unsubscribeLocale = null
          var locale = typeof ctx.get === 'function' ? ctx.get('locale') : undefined
          if (locale && typeof locale.register === 'function' && typeof locale.bind === 'function') {
            try {
              disposeDictionary = locale.register(NS, DICT)
              localeT = locale.bind(NS)
            } catch (error) {
              localeT = null
              disposeDictionary = null
            }
          }
          if (localeT !== null && typeof locale.subscribe === 'function') {
            unsubscribeLocale = locale.subscribe(function () {
              repaintForLocale()
            })
          }

          // The delete action as a host shortcut command (`session.delete`,
          // Ctrl+Shift+D), registered through registerDeleteShortcut().
          //
          // ORDER-INDEPENDENT ARMING (host-verified on 0.1.7-rc.2): this
          // plugin's apply runs BEFORE dsh-client-shortcuts provides its
          // service, so a single apply-time ctx.get('shortcuts') finds
          // nothing and the shortcut would silently never arm — which is
          // exactly what the first cut of this feature shipped. Two dead
          // ends were considered and rejected: (a) declaring
          // inject:['shortcuts'] — dsh.client.inject edges are load metadata,
          // never apply sequencing (see the comment above dsh-client-ui-
          // workspace's inject array), and a required-but-missing service
          // keeps the whole plugin inactive, taking the row-menu entry down
          // with it; (b) polling — unnecessary. cordis emits
          // `internal/service` whenever a service becomes available
          // (ReflectService.notify), so:
          //   1. try once at apply (covers hosts where the service is up);
          //   2. subscribe to the service event and arm the moment
          //      `shortcuts` appears, then unsubscribe;
          //   3. safety net: retry at the first session-menu injection
          //      (see tryInject), which by definition happens after boot.
          disposeShortcut = registerDeleteShortcut(ctx)
          if (
            shortcutState === 'pending'
            && ctx !== null
            && ctx !== undefined
            && typeof ctx.on === 'function'
          ) {
            unsubscribeService = ctx.on('internal/service', function (name) {
              if (name !== 'shortcuts' || shortcutState !== 'pending') return
              disposeShortcut = registerDeleteShortcut(ctx)
              if (shortcutState !== 'pending') {
                unsubscribeService()
                unsubscribeService = null
              }
            })
          }

          var observer = new MutationObserver(function () {
            tryInject()
          })
          observer.observe(document.body, { childList: true, subtree: true })
          return function () {
            hostContext = null
            if (typeof unsubscribeService === 'function') unsubscribeService()
            unsubscribeService = null
            if (typeof disposeShortcut === 'function') disposeShortcut()
            disposeShortcut = null
            shortcutState = 'pending'
            if (typeof unsubscribeLocale === 'function') unsubscribeLocale()
            if (typeof disposeDictionary === 'function') disposeDictionary()
            localeT = null
            observer.disconnect()
            modalOpen = false
            dialogTarget = null
            if (root !== null) root.unmount()
            root = null
            if (container !== null && container.parentNode) container.parentNode.removeChild(container)
            container = null
          }
        },
        'dsh-delete-session: sidebar session row menu entry',
      )
    }

    exports.apply = apply
    exports.inject = []
    return module.exports
  },
})
