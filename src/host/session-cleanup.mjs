// Written for dsh-delete-session (not ported).
// The archive-reconciliation helper below is ported from dsh-chat-manager
// v1.3.6 (https://github.com/WSL043/dsh-chat-manager), MIT License — its
// `restoreArchivedSession` registry seam (src/host/archive-manager.mjs:60-87)
// and the `deleteSessionAndReconcileArchive` warn-and-continue policy
// (src/host/archive-manager.mjs:90-100). Modified for dsh-delete-session: the
// blueprint's public `unarchiveSession` branch is retained as a forward
// compatibility probe, the id is never restored into the session log, and the
// workspace detach plus the `api-session/removed` broadcast are new and live
// here instead of in the blueprint's archive-manager.

const assertSessionId = sessionId => {
  if (typeof sessionId !== 'string' || sessionId.length === 0 || sessionId.length > 512 || sessionId.includes('\0')) {
    throw new TypeError('invalid session id')
  }
  return sessionId
}

const archiveIds = workspaceRegistry => {
  const ids = workspaceRegistry?.archivedSessionIds
  if (!Array.isArray(ids) || ids.some(id => typeof id !== 'string')) {
    throw new Error('unsupported workspace registry archive snapshot')
  }
  return [...ids]
}

/**
 * Remove one id from DSH's registry-global archive set after its storage was
 * permanently removed. Never touches the session log or its workspace
 * accounting position; the archived id must not survive the deleted session.
 *
 * Seam choice: `unarchiveSession` is probed first (public-facing, forward
 * compatible), but the workspace build installed on this machine does NOT
 * expose it — grepping `D:\.dsh\profiles\node_modules\@deepseek-ai\dsh-workspace\lib`
 * for `unarchiveSession` returns no match — so the live path is the validated
 * private registry seam, exactly as in the blueprint:
 * `enqueueOperation` (lib/index.js:774), `requireState` (lib/index.js:766) and
 * `setState` (lib/index.js:770). Going through `enqueueOperation` keeps the
 * write on the domain write chain instead of racing the registry.
 */
export async function reconcileArchiveMarker(workspaceRegistry, sessionId) {
  const id = assertSessionId(sessionId)
  if (typeof workspaceRegistry?.unarchiveSession === 'function') {
    const wasArchived = archiveIds(workspaceRegistry).includes(id)
    await workspaceRegistry.unarchiveSession(id)
    // `wasArchived` is reported for diagnostics only: an id that was never
    // archived is already absent from the set, which is the same reconciled
    // outcome as a successful removal.
    return { reconciled: true, wasArchived, archivedSessionIds: [...archiveIds(workspaceRegistry)] }
  }
  if (
    typeof workspaceRegistry?.enqueueOperation !== 'function'
    || typeof workspaceRegistry?.requireState !== 'function'
    || typeof workspaceRegistry?.setState !== 'function'
  ) {
    throw new Error('unsupported workspace registry archive seam')
  }

  return workspaceRegistry.enqueueOperation(async () => {
    const state = workspaceRegistry.requireState()
    if (!Array.isArray(state?.archivedSessionIds)) {
      throw new Error('unsupported workspace registry archive state')
    }
    if (!state.archivedSessionIds.includes(id)) {
      return { reconciled: true, archivedSessionIds: [...state.archivedSessionIds] }
    }
    const archivedSessionIds = state.archivedSessionIds.filter(candidate => candidate !== id)
    await workspaceRegistry.setState({ ...state, archivedSessionIds })
    return { reconciled: true, archivedSessionIds }
  })
}

/**
 * Drop a permanently deleted session from the workspace accounting.
 *
 * Basis (read from this machine's host, not inferred from the blueprint):
 * - `workspaceRegistry.list()` (…/dsh-workspace/lib/index.js:384-390) returns
 *   the fresh ordered entity array from the in-memory state — no persistence
 *   read per call.
 * - `entity.sessionIds` (lib/index.js:102-104) is the durable candidate list
 *   filtered by `host.sessionPath(id) === record.path`, so an id that is still
 *   accounted shows up here even after its log file is gone (the path index is
 *   an in-memory cwd map, lib/index.js:325-330, never re-read on access).
 * - `entity.detachSession(id)` (lib/index.js:148-153) is public API
 *   (lib/types/types.d.ts:83-91): idempotent (a non-accounted id resolves
 *   without writing) and it "never touches the session's own stored log",
 *   which is why it is safe to run after (not before) the physical delete.
 *
 * A session that belongs to no workspace is a normal, non-failing outcome:
 * nothing is returned to detach and `detached` stays false.
 */
export async function detachSessionFromWorkspace(workspaceRegistry, sessionId) {
  const id = assertSessionId(sessionId)
  if (typeof workspaceRegistry?.list !== 'function') return { detached: false, reason: 'unsupported' }
  for (const entity of workspaceRegistry.list()) {
    if (typeof entity?.detachSession !== 'function') continue
    const sessionIds = entity.sessionIds
    if (!Array.isArray(sessionIds) || !sessionIds.includes(id)) continue
    await entity.detachSession(id)
    return { detached: true }
  }
  return { detached: false, reason: 'unaccounted' }
}

/**
 * Broadcast one Session removal so the official clients drop the row.
 *
 * Host-verified event contract:
 * `D:\.dsh\profiles\node_modules\@deepseek-ai\dsh-api-session-controller\lib\types\types.d.ts:550`
 * declares `'api-session/removed'(sessionId: SessionId): void`, and the host
 * controller itself emits it from the `session/disposed` listener
 * (lib/index.js:2752-2753). The client relays it to
 * `sessions.handleSessionRemoved(sessionId)` (lib/client.js:3510-3512), which
 * records a `{ kind: 'remove', sessionId }` list mutation
 * (lib/client.js:2721-2736) — that is what removes the sidebar row. A session
 * with a 'subagent' origin is deliberately downgraded to a status update
 * instead of a row removal by that official handler; that branch is the
 * host's own policy and is left untouched here.
 */
export function broadcastSessionRemoved(ctx, sessionId) {
  ctx.emit('api-session/removed', sessionId)
}

/**
 * Compose the post-delete accounting steps. Both steps are advisory: the
 * storage is already gone by the time this runs, so neither may turn an
 * already-successful deletion into a failure. Each step is isolated in its own
 * try/catch and reports its own boolean, and both run even when the other one
 * fails, so the caller always learns exactly which part of the accounting was
 * reconciled.
 */
export async function cleanupSessionAccounting({ workspaceRegistry, ctx, warn = console.warn }, sessionId) {
  let workspaceDetached = false
  let archiveReconciled = false
  try {
    workspaceDetached = (await detachSessionFromWorkspace(workspaceRegistry, sessionId)).detached
  } catch (error) {
    warn('session storage was deleted but its workspace accounting could not be detached:', error)
  }
  try {
    archiveReconciled = (await reconcileArchiveMarker(workspaceRegistry, sessionId)).reconciled
  } catch (error) {
    warn('session storage was deleted but its archive marker could not be reconciled:', error)
  }
  try {
    broadcastSessionRemoved(ctx, sessionId)
  } catch (error) {
    warn('session storage was deleted but the client removal broadcast failed:', error)
  }
  return { workspaceDetached, archiveReconciled }
}

/**
 * Delete first, then reconcile accounting. `workspaceDetached` and
 * `archiveReconciled` are added to the storage-level success payload; a
 * storage failure is returned unchanged, which keeps the HTTP 409 semantics of
 * the ported boundary intact.
 */
export async function deleteSessionAndReconcile({ workspaceRegistry, ctx, deleteSession, warn = console.warn }, sessionId) {
  const result = await deleteSession(sessionId)
  if (result?.ok !== true) return result
  const value = await cleanupSessionAccounting({ workspaceRegistry, ctx, warn }, sessionId)
  return { ok: true, value: { ...result.value, ...value } }
}
