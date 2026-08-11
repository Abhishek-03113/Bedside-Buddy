# Task — Mobile Remote Foundation

First milestone: laptop-hosted HTTP + WebSocket remote so a phone on the same Wi-Fi can open a minimal remote UI and control CoOSy.

**Sources of truth:** this file, [`docs/architecture.md`](docs/architecture.md), existing WS/pairing/discovery code.

## Legend

| Mark | Meaning |
|------|---------|
| `[ ]` | pending |
| `[~]` | in progress |
| `[x]` | done |
| `[-]` | deferred |

---

## Scope

- Run remote HTTP + WebSocket **inside** CoOSy desktop (no cloud / separate backend).
- Serve `packages/remote` UI from the laptop for LAN phones.
- Minimal phone UI: connection status, current source, D-pad, Select, Back, Home, Play/Pause, Seek ±, Volume ±.
- Reuse shared WS protocol, pairing, SourceHost / MediaSource command path.
- Soft-fail if remote server cannot start; desktop launcher still works.
- Production packaging serves remote assets without Vite.

**Out of scope (this milestone):** full browsing, Continue Watching remote UI, source-specific UIs, keyboard/touchpad/gestures, NAT traversal, cloud auth, perfect mDNS UX, installable PWA packaging.

---

## Architectural decisions

1. **Single LAN port for HTTP + WS** — one `http.Server` with `ws` upgrade (`remote-server.ts`). Phone opens `http://<lan-ip>:<port>`; WebSocket uses the same host/port. Env: `COOSY_WS_PORT` (default `17832`). Binds `0.0.0.0`.
2. **Reuse existing protocol** — `hello` / `hello-ack` / `command` / `nav` / `context` / `command-result` / `toast` / `error`. No second command protocol.
3. **Pairing** — reuse 6-digit code + trusted `clientId` in SQLite (`pairing.ts`). Phone persists `clientId` in `localStorage` and prompts for code when not trusted.
4. **Nav ownership** — remote server only forwards `nav` to the renderer (`sendNavToRenderer`); HomeScreen owns focus / Select / Home semantics (same path as local Enter / arrows).
5. **Media commands** — WS → active `MediaSource.handleCommand` only; no source-specific branches in the remote server.
6. **Static UI** — built `packages/remote/dist` copied into desktop `out/remote` via `scripts/copy-remote-ui.mjs` for packaged runtime; `pnpm dev:remote` kept for development.
7. **Discovery** — existing mDNS left intact; primary path this milestone is type HTTP URL on phone (shown on launcher). Discovery polish deferred.
8. **Context payload** — `hello-ack` / `context` include `sources: { id, displayName }[]`, `mode`, `activeSourceId`, `capabilities` only.
9. **Soft-fail** — remote startup errors are logged, exposed as `connection.remoteError`, and do not crash the desktop shell.
10. **PWA plugin** — removed from remote Vite build for this milestone (broken transitive `resolve` dep); plain mobile web UI is sufficient. Installable PWA deferred.

---

## Implementation tasks

### Inspect / reuse

- [x] Inspect `packages/remote`, `ws-server`, pairing, discovery, shared protocol, packaging
- [x] Confirm reuse: WS handler, pairing, mDNS, nav→renderer, MediaSource dispatch

### Laptop remote server

- [x] Combined HTTP + WebSocket remote server (LAN bind `0.0.0.0`)
- [x] Serve remote static UI with path traversal safety + basic HTTP errors
- [x] Clean shutdown with CoOSy; close clients
- [x] Soft-fail remote startup (log + diagnostic; desktop continues)
- [x] Wire lifecycle in `main/index.ts`

### Protocol / desktop state

- [x] Enrich `hello-ack` / `context` with available source id/name list
- [x] Broadcast context on source changes
- [x] Connection info exposes HTTP URL for phone (+ pairing code visible on launcher)

### Mobile UI

- [x] Connection status: CONNECTED / CONNECTING / DISCONNECTED
- [x] Persist clientId; pairing code entry when required
- [x] Show current source / mode
- [x] D-pad, Select, Back, Home, Play/Pause, Seek ±, Volume ±
- [x] Simple reconnect (non-aggressive); command results surfaced (no silent success)
- [x] Phone-sized touch targets

### Packaging

- [x] Remote production build (`base: './'`)
- [x] Copy assets into desktop output / electron-builder files
- [x] Resolve static root in packaged vs dev layouts

### Tests

- [x] HTTP startup/shutdown + static serve
- [x] WS connect / lifecycle / pairing validation
- [x] Command + nav forwarding; context delivery
- [x] Reconnect / trusted client behavior

### Cleanup / docs

- [x] Remove dead DPad/Transport split screens (replaced by unified `RemoteControls`)
- [x] Preserve WS/pairing/discovery; `ws-server.ts` re-exports remote-server
- [x] Update this file with final status

---

## Progress

**Status:** complete for foundation milestone.

---

## Completed work

- `packages/desktop/src/main/remote-server.ts` — HTTP + WebSocket on one port
- `packages/desktop/src/main/remote-static.ts` — static UI serving
- Soft-fail remote lifecycle in `main/index.ts`
- Launcher shows pairing code + `http://<ip>:<port>`
- Mobile remote: pairing, status, unified controls, reconnect, persistent clientId
- Shared protocol: `mode` + `sources` on `hello-ack` / `context`
- Packaging: remote build → `out/remote`; desktop `build` script copies UI
- Tests: desktop remote-server + pairing; remote ws-client helpers + reconnect

---

## Deferred work

- Rich mDNS / QR discovery UX
- Full remote browsing / Continue Watching on phone
- Source-specific remote UIs
- Keyboard, touchpad, gestures
- Installable PWA / service worker packaging
- NAT traversal / cloud relay / public exposure
- Cryptographic pairing beyond 6-digit LAN code

---

## Known limitations

- Phone must reach laptop LAN IP; mDNS may still be flaky on some networks.
- Pairing is LAN-local 6-digit code, not cryptographic auth.
- Unit tests do not prove real-phone Wi-Fi usability.
- Media transport buttons are disabled while launcher is active (by design).
- If remote UI assets were not built/copied, HTTP returns 503 while WS may still work.

---

## Manual validation (phone on same Wi-Fi)

1. Build/run desktop: `pnpm --filter @coosy/desktop build` then `pnpm --filter @coosy/desktop dev` (or packaged app).
2. On the laptop launcher, note **Phone URL** (`http://<lan-ip>:17832`) and **Pairing code**.
3. On the phone browser, open that URL.
4. Enter the pairing code once → status **CONNECTED**.
5. Use D-pad + OK to focus/activate a source; Home returns to launcher.
6. With a source active: Play/Pause, Seek ±, Vol ±.
7. Toggle phone Wi-Fi off/on briefly → UI should reconnect without a full page reload.
8. Kill/restart CoOSy → phone shows disconnect/reconnect; desktop still works if remote port is blocked.
