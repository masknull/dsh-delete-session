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

DSH currently exposes **no public API for deleting a session**: `ctx.workspaceRegistry` offers `archiveSession` (soft, marker-only) and `deleteKnown` (which deletes a *workspace*, not a session), and the `api-session-controller` remote surface has create / rename / fork / list / search — but no delete. On top of that, the session-row `⋯` menu is **not an extension point**: its items are hardcoded inside the official `ui-workspace` `SessionNodeItem`, and no slot exists anywhere inside a session row.

So instead of forking the official UI, this plugin uses two DOM seams that were verified live against the running Web UI:

1. **Session row → React fiber.** A session row is `[role="treeitem"]`. Walking up its fiber chain reaches `SessionNodeItem`, whose `memoizedProps` carry `node` (with the session id) plus the official `onRename` / `onFork` / `onArchive` callbacks, used here purely as a shape test.
2. **The open menu popup.** The menu is a `[role="menu"]` portal whose items are `[role="menuitem"]`. When the menu is open for a row we just resolved, one extra item is appended. **Class names are copied from a live official item at runtime**, so the entry inherits the real styling even though the generated class hashes change between builds. The icon is the official `IconTrashOutline16` geometry lifted from the shipped frontend bundle, so it matches the three native icons.

If either seam is gone (a future official UI change), the entry is simply never injected — the plugin never falls back to guessing a session id.

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

The plugin depends on the two DOM seams above. If an official UI change removes either one, the symptom is **the entry missing from the menu** — never a wrong deletion.

Check, in order:

1. Is a session row still `[role="treeitem"]`, and does its fiber chain still reach props carrying `node.id` plus `onRename`?
2. Is the popup still `[role="menu"]` with `[role="menuitem"]` items?
3. Does React still attach fibers to DOM nodes (`__reactFiber$` / `__reactInternalInstance$` prefixes)?

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
