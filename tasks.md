# CoOSy — Tasks

Track progress against the PRD and architecture. Update this file as work lands.

> **Repo scope:** only `packages/shared` and `packages/desktop`. Phone remote (`packages/remote`) is out of scope in this repository — see [`docs/notes.md`](docs/notes.md).
>
> **Detailed POC checklist:** [`tasks-desktop-poc.md`](tasks-desktop-poc.md)

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

- [x] Widevine / DRM spike in Electron (castlabs ECS `v42.8.0+wvcus`) — **GO** (see `docs/widevine-spike.md`); HD playback still manual
- [x] Confirm OS target (macOS first)
- [x] Pairing UX: one-time code on TV + WS hello (PWA install deferred with remote package)
- [x] Confirm Continue Watching stays out of v1 (architecture §4)

## Phase 2 — Desktop shell (infra)

- [x] Electron window bootstrap (fullscreen launcher)
- [x] `source-host.ts` — WebContentsView lifecycle + session partitions + key input
- [x] SQLite schema + `db.ts` (sources, app_state) — better-sqlite3@13 for Electron 42
- [x] `ws-server.ts` — source-agnostic WebSocket command dispatch + pairing
- [x] `discovery.ts` — mDNS/Bonjour + IP/pairing shown on home
- [x] Preload `contextBridge` IPC surface
- [-] Serve remote PWA from local HTTP server (remote out of scope; use `ws-smoke.mjs`)

## Phase 3 — Shared protocol & Netflix source

- [x] Finalize `@coosy/shared` types (`SourceInput` / `bindInput`)
- [x] `NetflixSource` + `netflix-commands.ts` (key-event translation)
- [x] Register Netflix in `sources/registry.ts`
- [x] Honest `CommandResult` → TV toast + phone feedback

## Phase 4 — TV launcher UI (renderer)

- [x] HomeScreen — source tiles from registry metadata + pairing footer
- [x] LoadingScreen
- [x] PlayerOverlay + remote toast
- [x] ContinueCard gated on `supportsNowPlayingMetadata` (no fake data)
- [x] D-pad / keyboard-navigable focus model

## Phase 5 — Phone remote (PWA)

**Out of scope in this repo** (see [`docs/notes.md`](docs/notes.md)).

- [-] DPadScreen (navigate launcher)
- [-] TransportScreen (buttons from `SourceCapabilities`)
- [-] `ws-client.ts` — generic `RemoteCommand` only
- [-] Pairing / reconnect UI
- [-] PWA manifest + service worker shell

## Phase 6 — v1 success criteria

Desktop-side criteria only in this repo; full phone-driven bar depends on remote work elsewhere.

- [x] Shell boots with Widevine CDM + WS + pairing code
- [ ] Launch Netflix into fullscreen (manual)
- [ ] Play / pause / seek ±10s / return home (command path through desktop — manual with `ws-smoke`)
- [ ] Session persistence across restarts (partition)
- [ ] Source switch keeps previous view alive (paused, not destroyed)

## Deferred (post-v1)

- [-] Continue Watching shelf (v1.5)
- [-] System-level volume API
- [-] Trackpad + keyboard fallback on phone
- [-] YouTube / Prime / Hotstar sources
- [-] Go WebSocket sidecar
- [-] Multi-user / multi-room
