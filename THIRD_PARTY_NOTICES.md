# Third-party notices

## dsh-chat-manager

- Source: <https://github.com/WSL043/dsh-chat-manager>
- Version referenced: v1.3.6
- License: MIT
- What was used:
  - `src/host/delete-session.mjs` — ported. The whole permanent-delete path is
    kept, including the agent-handle tracker, the reservation that refuses to
    reopen a session mid-deletion, the three-segment path-shape validation, the
    quarantine-rename + `dev`/`ino`/`mode`/`size`/`birthtimeNs` identity
    re-check, the recursive removal, and the HTTP request boundary
    (POST-only / same-origin / confirmation header / JSON / 8 KB cap /
    session-id shape).
  - The `enqueueOperation` / `requireState` / `setState` seam used to drop an id
    from `archivedSessionIds`, and the warn-and-continue policy around it.
- What was changed:
  - Plugin name and the single route path.
  - The archive-browsing, restore, content-search and cold-session surfaces were
    **not** ported; this plugin registers exactly one route.
  - The upstream UI-replacement scheme was **not** adopted either: only the
    Host-side deletion implementation is reused. This plugin does not disable,
    replace or take over any official plugin row — see `cordis.patch.yml`,
    which contains a single `insert` and no `disabled` directive at all.
  - New: post-delete accounting reconciliation through public API
    (`workspace.list()` → `entity.detachSession(id)`), plus the
    `api-session/removed` broadcast.
  - New: fail-soft activation — a missing precondition degrades to
    "route not registered" instead of throwing during plugin activation.
  - New: zh/en localisation through the host locale service, with a built-in
    fallback table when that service is absent.

## DSH frontend icon geometry

`lib/client.js` embeds the `IconTrashOutline16` path lifted from the DeepSeek
Harness frontend bundle (`@deepseek-ai/dsh-client-ui-primitives`, MIT) so the
menu entry matches the native session-row icons instead of introducing a
foreign glyph.
