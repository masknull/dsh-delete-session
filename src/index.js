// Plugin assembly written for dsh-delete-session.
// The delete route, agent handle tracker and request boundary are ported from
// dsh-chat-manager v1.3.6 (https://github.com/WSL043/dsh-chat-manager), MIT
// License. Modified for dsh-delete-session: the plugin name, the single route
// path below, the post-delete workspace/archive reconciliation, and the
// fail-soft activation contract documented on apply().
import {
  createDeleteRequestHandler,
  deleteSessionSafely,
  installAgentHandleTracker,
} from './host/delete-session.mjs'
import { deleteSessionAndReconcile } from './host/session-cleanup.mjs'

export const name = 'dsh-delete-session'
export const inject = ['webServer', 'sessionPersistence', 'sessions', 'agents', 'workspaceRegistry']

/**
 * Stand-in used when the agent handle tracker cannot be installed. Deletion
 * still works for sessions that are not running; a running session is refused
 * by deleteSessionSafely rather than force-stopped.
 */
const INERT_HANDLE_TRACKER = {
  reserve: () => undefined,
  dispose: async () => false,
  release: async () => {},
}

export function apply(ctx) {
  const warn = message => ctx.logger?.warn?.(`dsh-delete-session: ${message}`)

  // Never throw out of apply(). A throwing plugin row takes the whole plugin
  // tree down at boot — the exact failure class this plugin was written to
  // avoid. Every precondition below degrades to "route not registered", which
  // surfaces in the UI as a failed request instead of a dead server.
  const sessionRoot = ctx.sessionPersistence?.config?.root ?? ctx.sessionPersistence?.root
  if (typeof sessionRoot !== 'string' || sessionRoot.length === 0) {
    warn('per-session JSONL persistence root unavailable; delete route not registered')
    return
  }

  let agentHandles = INERT_HANDLE_TRACKER
  try {
    agentHandles = installAgentHandleTracker(ctx.agents, ctx.sessions)
    ctx.effect(() => () => agentHandles.release(), 'dsh-delete-session: agent lifecycle tracking')
  } catch (error) {
    warn(
      `agent lifecycle tracking unavailable (${String(error)}); a running session will be refused instead of stopped`,
    )
    agentHandles = INERT_HANDLE_TRACKER
  }

  const deleteSession = sessionId =>
    deleteSessionSafely(
      {
        sessions: ctx.sessions,
        agents: ctx.agents,
        agentHandles,
        sessionPersistence: ctx.sessionPersistence,
      },
      { sessionRoot, sessionId },
    )
  const handler = createDeleteRequestHandler({
    deleteSession: sessionId =>
      deleteSessionAndReconcile(
        {
          workspaceRegistry: ctx.workspaceRegistry,
          ctx,
          deleteSession,
        },
        sessionId,
      ),
  })

  // `kind: 'exact'` matches the pathname verbatim (dsh-host-webserver
  // lib/types/index.d.ts:30-31) and register() returns a disposer, which is
  // what ctx.effect consumes. A duplicate path would throw inside register(),
  // so registration is guarded too.
  try {
    ctx.effect(
      () => ctx.webServer.register({
        kind: 'exact',
        path: '/plugins/dsh-delete-session/delete',
        handler,
      }),
      'dsh-delete-session: confirmed permanent deletion route',
    )
  } catch (error) {
    warn(`delete route not registered (${String(error)})`)
  }
}

export {
  createDeleteRequestHandler,
  deleteSessionSafely,
  installAgentHandleTracker,
} from './host/delete-session.mjs'

export {
  broadcastSessionRemoved,
  cleanupSessionAccounting,
  deleteSessionAndReconcile,
  detachSessionFromWorkspace,
  reconcileArchiveMarker,
} from './host/session-cleanup.mjs'
