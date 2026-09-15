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
//   1. The session row is `[role="treeitem"]`; its React fiber chain reaches
//      SessionNodeItem, whose memoizedProps carry `node` (with the session id)
//      and the official onRename/onFork/onArchive callbacks.
//   2. The row menu is a `[role="menu"]` portal with `[role="menuitem"]`
//      buttons. Class names carry a build hash (`_item_1nxmc_92`), so this
//      bundle copies class names from a live official item instead of
//      hardcoding them.
//
// If either seam is missing (a future official UI change), the entry is simply
// never injected — this bundle never falls back to guessing a session id.
//
// Localisation follows the host locale service when it is present and falls
// back to a built-in zh/en table selected from `<html lang>` when it is not.

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

    /**
     * Walk up from a session row element to the SessionNodeItem fiber and
     * return its props. Identified by shape, not by component name: a props
     * object carrying `node` (with a string id) plus the official `onRename`
     * callback is unambiguous in this tree.
     * @returns {{node: {id: string, title?: string}}|null}
     */
    function sessionNodeProps(element) {
      var key = fiberKeyOf(element)
      if (key === null) return null
      var fiber = element[key]
      var hops = 0
      while (fiber && hops < 80) {
        var props = fiber.memoizedProps
        if (
          props &&
          props.node &&
          typeof props.node.id === 'string' &&
          typeof props.onRename === 'function'
        ) {
          return props
        }
        fiber = fiber.return
        hops += 1
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
    function buildMenuItem(menu) {
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
      button.style.color = 'var(--dsw-alias-state-error-primary, #ec1313)'
      button.addEventListener('click', onDeleteItemClick)

      wrap.appendChild(button)
      return wrap
    }

    // ---------------------------------------------------------------- state

    /** The session row whose menu button was last clicked, or null. */
    var pending = null
    /** Set while our confirm dialog is open, to suppress re-injection. */
    var modalOpen = false

    function tryInject() {
      if (pending === null || modalOpen) return
      var menu = findOpenMenu()
      if (menu === null) return
      if (menu.querySelector('[' + ITEM_ATTR + ']') !== null) return
      var viewport = menu.querySelector('[role="presentation"]') || menu
      viewport.appendChild(buildMenuItem(menu))
    }

    function onDocumentClickCapture(event) {
      var target = event.target
      if (!target || typeof target.closest !== 'function') return
      var button = target.closest('button[aria-label]')
      if (button === null) return
      var row = button.closest('[role="treeitem"]')
      if (row === null) return
      var props = sessionNodeProps(row)
      if (props === null) return
      var title = typeof props.node.title === 'string' && props.node.title !== '' ? props.node.title : props.node.id
      pending = { sessionId: props.node.id, title: title, anchor: button }
    }

    /** Toggle the official menu closed through its own anchor button. */
    function closeOfficialMenu() {
      if (findOpenMenu() === null) return
      if (pending !== null && pending.anchor && document.contains(pending.anchor)) pending.anchor.click()
    }

    function onDeleteItemClick(event) {
      event.preventDefault()
      event.stopPropagation()
      var target = pending
      if (target === null) return
      closeOfficialMenu()
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
      if (modalOpen && root !== null && pending !== null) {
        root.render(React.createElement(ConfirmDialog, { target: pending, onDone: closeConfirm }))
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

    function ensureModalHost() {
      if (container !== null && document.contains(container)) return
      container = document.createElement('div')
      container.setAttribute(MODAL_ATTR, '1')
      document.body.appendChild(container)
      root = ReactDOMClient.createRoot(container)
    }

    function closeConfirm() {
      modalOpen = false
      pending = null
      if (root !== null) root.render(null)
    }

    function openConfirm(target) {
      ensureModalHost()
      modalOpen = true
      root.render(React.createElement(ConfirmDialog, { target: target, onDone: closeConfirm }))
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
    // No explicit border: --dsw-elevation-panel already carries the 0.5px
    // hairline stroke the official menus use.
    var panelStyle = {
      minWidth: '360px',
      maxWidth: '520px',
      background: 'var(--dsw-specific-menu, var(--dsw-alias-bg-layer-3, #fff))',
      color: 'var(--dsw-alias-label-primary, #0f1115)',
      borderRadius: '16px',
      padding: '20px',
      boxShadow: 'var(--dsw-elevation-panel, 0 0 0 0.5px rgba(0, 0, 0, 0.16), 0 3px 8px rgba(0, 0, 0, 0.03), 0 0 16px rgba(0, 0, 0, 0.02))',
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

      React.useEffect(function () {
        function onKey(event) {
          if (event.key === 'Escape') props.onDone()
        }
        document.addEventListener('keydown', onKey)
        return function () {
          document.removeEventListener('keydown', onKey)
        }
      }, [])

      function confirm() {
        setBusy(true)
        setError(null)
        requestDelete(target.sessionId)
          .then(function () {
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

          var observer = new MutationObserver(function () {
            tryInject()
          })
          document.addEventListener('click', onDocumentClickCapture, true)
          observer.observe(document.body, { childList: true, subtree: true })
          return function () {
            if (typeof unsubscribeLocale === 'function') unsubscribeLocale()
            if (typeof disposeDictionary === 'function') disposeDictionary()
            localeT = null
            document.removeEventListener('click', onDocumentClickCapture, true)
            observer.disconnect()
            pending = null
            modalOpen = false
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
