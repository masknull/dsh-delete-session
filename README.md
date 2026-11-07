# dsh-delete-session

> Permanently delete a single session from the DeepSeek Harness Web sidebar — one extra entry in the session row's `⋯` menu.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
**English** · [中文](README.zh.md)

`dsh-delete-session` adds a **Delete session** action to the sidebar session-row menu (next to *Rename* / *Fork* / *Archive*) and permanently removes that session's transcript from disk.

It does this **without replacing or disabling any official plugin row** and **without taking over any host service**, so it cannot break the plugin tree the way a service-replacing plugin can.

---

## Features

| | |
|---|---|
| **Permanent delete** | Removes the session's per-session JSONL transcript directory from disk. No recycle bin, no undo. |
| **Confirmation is mandatory** | A modal naming the session is required, and the request carries a non-simple custom header that a plain HTML form or link cannot forge. |
| **Running sessions are stopped first** | The live agent is torn down through its owned host handle; persistence is drained and the session is verified detached before any file is touched. |
| **Bookkeeping reconciled** | The session is detached from its workspace, removed from the archive set, and the UI is told to drop the row — no manual refresh needed. |
| **Zero takeover** | The bundle inserts exactly one plugin row. It disables nothing, replaces nothing, and publishes no service. |
| **Theme-aware** | The confirmation dialog uses DSH's own theme variables, so it follows light and dark mode automatically. |
| **Localised** | Menu entry and dialog follow the host locale (zh / en) through the host locale service, with a built-in fallback table when that service is absent. |

---

## Requirements

- DeepSeek Harness with the **Web** profile (`dsh web`).
- The per-session JSONL persistence backend (`session-persistence-jsonl`), which is the stock backend.
- Verified against DSH `0.1.5-rc.2`. The delete route is fail-soft: if a precondition is missing the route is simply not registered and the UI reports a request failure — the plugin never throws during activation.

---

## Install

```powershell
# from a git checkout
dsh plugin --profile web add github:masknull/dsh-delete-session

# or from a local directory
dsh plugin --profile web add link:/path/to/dsh-delete-session
```

Restart `dsh web` afterwards so the plugin tree is recomposed.

## Uninstall

```powershell
dsh plugin --profile web remove dsh-delete-session
```

---

## Motivation

All that was needed was the delete action. Session-management plugins of this kind usually bundle a whole suite along with it — archiving, restore, search — and there were also *intermittent* `dsh web` startup failures that took an afternoon to pin down. Since only deletion was needed, this plugin was written separately to do exactly that and nothing else.

## How it works

DSH currently exposes **no public API for deleting a session**: `ctx.workspaceRegistry` offers `archiveSession` (soft, marker-only) and `deleteKnown` (which deletes a *workspace*, not a session), and the `api-session-controller` remote surface has create / rename / fork / list / search — but no delete. Since 0.2.2-rc.1, the official `@deepseek-ai/dsh-client-ui-context-menu` makes the session context menu an extension point.

Since dsh 0.2.2-rc.1 the entry is contributed through the official context-menu registry (`@deepseek-ai/dsh-client-ui-context-menu`): one `session`-target contribution whose target captures `{ sessionId, displayTitle }` at gesture time — there is no cached "last clicked row" state that could go stale and act on the wrong session.

The action binds `commandId: 'session.delete'`, so the overlay renders the user's live Ctrl+Shift+D binding from the shortcuts catalog; it uses the official `danger` styling, and the icon is the official `IconTrashOutline16` geometry contributed through the keyed `contextMenu.icon` Slot.

### Host side

One route: `POST /plugins/dsh-delete-session/delete`.

The deletion itself is a port of [`dsh-chat-manager`](https://github.com/WSL043/dsh-chat-manager)'s implementation (MIT — see *License*), which is careful in ways worth keeping:

- the target path must be exactly three segments under the session root, with the transcript filename matching the JSONL generation pattern;
- the session directory is atomically **renamed into a quarantine directory**, then its identity is re-verified via `dev`/`ino`/`mode`/`size`/`birthtimeNs` before the recursive delete (defence against TOCTOU and symlink swaps);
- a live agent is disposed through the handle captured from `agents.create` / `resume` / `enter`, and a *reservation* refuses to reopen the session while its deletion is in flight;
- the request boundary enforces POST-only, same-origin, the confirmation header, JSON content type, an 8 KB body cap, and session-id shape.

**Added on top of the port:** after the physical delete, the plugin reconciles accounting through public API —
`workspace.list()` → find the owning entity → `entity.detachSession(id)` (public, idempotent, never touches the session log),
then removes the id from `archivedSessionIds`, then emits `api-session/removed` so the official client drops the row.

### What is *not* deleted

The projection cache row (`session_projcache`) is intentionally left behind. The session list is built from a disk scan plus a host/client double join filter, so an orphaned cache row never renders as a visible entry. Cleaning it would require replacing the official `session-projection-cache` service — exactly the kind of takeover this plugin exists to avoid.

---

## Theming

The confirmation dialog takes every colour from DSH's own theme variables. Those are declared on `<body>` and re-declared under `body[data-ds-dark-theme]`, so one declaration follows both themes:

| Purpose | Variable |
|---|---|
| Dialog surface | `--dsw-specific-menu` → `--dsw-alias-bg-layer-3` |
| Primary text | `--dsw-alias-label-primary` |
| Border | `--dsw-alias-border-l2` |
| Danger | `--dsw-alias-state-error-primary` |
| Scrim | `--dsw-alias-bg-mask-1` |
| Shadow (carries the 0.5px hairline) | `--dsw-elevation-panel` |
| Font | `--dsw-font-family` |

Two traps learned the hard way, both documented in `README.zh.md`:

- **Do not invent variable names.** The first release used plausible-looking names such as `--dsw-alias-bg-elevated`; they do not exist, so the surface fell back to a hardcoded dark grey while the text variable *did* resolve to the theme's dark colour — producing dark-on-dark in light mode.
- **Variables live on `<body>`, not `:root`.** Reading them from `document.documentElement` returns empty strings.

---

## Troubleshooting

The entry rides the official context-menu registry. If it ever goes missing, the symptom is **the entry missing from the menu** — never a wrong deletion.

Check, in order:

1. The running DSH is 0.2.2-rc.1 or newer (that release ships `@deepseek-ai/dsh-client-ui-context-menu`);
2. The plugin is enabled and its client bundle loaded — the DevTools console shows a `dsh-delete-session: contextMenus registration refused` warning otherwise;
3. The composition mounts the registry's client plugin (the shipped Web app does; a custom composition may have dropped it).

---

## License

MIT. The deletion implementation under `src/host/` is ported from
[dsh-chat-manager](https://github.com/WSL043/dsh-chat-manager) (MIT); each ported
file keeps a header stating its origin and the changes made.

## Acknowledgements

Thanks to [dsh-chat-manager](https://github.com/WSL043/dsh-chat-manager): this
plugin's core is built on its Host-side deletion implementation. The genuinely
hard parts — capturing the agent handle, the quarantine rename with `dev`/`ino`
identity re-checks, and the request boundary — were already solved well there,
which is exactly why this plugin could stay this small.

Thanks as well to the DeepSeek Harness team: the theme variables, the locale
service, and the `IconTrashOutline16` geometry used here all come from the
official frontend.
