# CoOSy — Tasks

Track progress against the PRD and architecture. Update this file as work lands.

## Legend

- `[ ]` pending
- `[~]` in progress
- `[x]` done
- `[-]` deferred / out of scope for current phase

---

## Phase 0 — Repository scaffolding

- [x] Create `docs/architecture.md` and `docs/PRD.md`
- [x] Create root `tasks.md`
- [x] pnpm workspace (`pnpm-workspace.yaml`, root `package.json`)
- [x] Shared TypeScript base config (`tsconfig.base.json`)
- [x] Root `.gitignore` for TypeScript / Electron / Node
- [x] `packages/shared` — command, MediaSource, WS protocol types
- [x] `packages/desktop` — Electron main / preload / renderer stubs
- [x] `packages/remote` — phone PWA stubs
- [x] README with workspace overview

## Phase 1 — Blocking spikes & decisions

- [ ] Widevine / DRM spike in Electron (castlabs or component) — **go/no-go**
- [ ] Confirm OS target (macOS / Windows / Linux / both)
- [ ] Pairing UX: zero-setup IP vs one-time PWA install
- [ ] Confirm Continue Watching stays out of v1 (architecture §4)

## Phase 2 — Desktop shell (infra)

- [ ] Electron window bootstrap (fullscreen launcher)
- [ ] `source-host.ts` — WebContentsView lifecycle + session partitions
- [ ] SQLite schema + `db.ts` (sources, app_state)
- [ ] `ws-server.ts` — source-agnostic WebSocket command dispatch
- [ ] `discovery.ts` — mDNS/Bonjour + QR/IP fallback
- [ ] Preload `contextBridge` IPC surface
- [ ] Serve remote PWA from local HTTP server

## Phase 3 — Shared protocol & Netflix source

- [ ] Finalize `@coosy/shared` types against real wire messages
- [ ] `NetflixSource` + `netflix-commands.ts` (key-event translation)
- [ ] Register Netflix in `sources/registry.ts`
- [ ] Honest `CommandResult` → TV toast + phone feedback

## Phase 4 — TV launcher UI (renderer)

- [ ] HomeScreen — source tiles from registry metadata
- [ ] LoadingScreen
- [ ] PlayerOverlay + remote toast
- [ ] ContinueCard gated on `supportsNowPlayingMetadata` (no fake data)
- [ ] D-pad / keyboard-navigable focus model

## Phase 5 — Phone remote (PWA)

- [ ] DPadScreen (navigate launcher)
- [ ] TransportScreen (buttons from `SourceCapabilities`)
- [ ] `ws-client.ts` — generic `RemoteCommand` only
- [ ] Pairing / reconnect UI
- [ ] PWA manifest + service worker shell

## Phase 6 — v1 success criteria

- [ ] Launch Netflix into fullscreen from phone
- [ ] Play / pause / seek ±10s / return home from phone only
- [ ] Session persistence across restarts (partition)
- [ ] Source switch keeps previous view alive (paused, not destroyed)

## Deferred (post-v1)

- [-] Continue Watching shelf (v1.5)
- [-] System-level volume API
- [-] Trackpad + keyboard fallback on phone
- [-] YouTube / Prime / Hotstar sources
- [-] Go WebSocket sidecar
- [-] Multi-user / multi-room
