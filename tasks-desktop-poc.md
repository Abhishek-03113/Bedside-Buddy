# Tasks — Desktop POC (`packages/desktop`)

Implementation tracker for the CoOSy Electron shell POC.

**Sources of truth:** [`docs/PRD.md`](docs/PRD.md), [`docs/architecture.md`](docs/architecture.md), [`docs/notes.md`](docs/notes.md), [`docs/widevine-spike.md`](docs/widevine-spike.md)

**In scope:** `packages/shared`, `packages/desktop`  
**Out of scope (this repo):** `packages/remote` (phone PWA) — desktop still exposes the WS surface the remote will use later.

## Legend

| Mark | Meaning |
|------|---------|
| `[ ]` | pending |
| `[~]` | in progress |
| `[x]` | done |
| `[s]` | scaffolded (file/stub exists; not wired or not validated) |
| `[-]` | deferred / out of scope for this POC |

## Success bar (desktop-side POC)

From the laptop shell alone (phone remote exercised via `scripts/ws-smoke.mjs`):

1. Fullscreen home with Netflix tile
2. Launch Netflix into a chromeless `WebContentsView` (session partition persisted)
3. Dispatch play / pause / seek ±10s / volume via source-agnostic WS → `MediaSource.handleCommand`
4. Honest TV toast from `CommandResult`
5. Return home without destroying the Netflix view (paused, kept alive)

---

## 1. Blocking decisions & spikes

- [x] **Widevine / DRM spike** — GO provisionally on castlabs ECS `v42.8.0+wvcus` (see [`docs/widevine-spike.md`](docs/widevine-spike.md))
- [x] Confirm **OS target** for POC — macOS first
- [x] Confirm **Continue Watching stays out of v1** — Netflix `supportsNowPlayingMetadata: false`
- [x] Exercise remote protocol without `packages/remote` — `packages/desktop/scripts/ws-smoke.mjs`
- [x] Manual smoke: ECS boots; Widevine CDM component reports ready (`docs/widevine-spike.md`)
- [ ] Manual: Netflix title actually plays HD under ECS on this machine (checklist in spike doc)

---

## 2. Wire the Electron shell (infra)

### 2.1 Main ↔ renderer IPC

- [x] Register `ipcMain` handlers: `sources:list`, `sources:open`, `launcher:show`, `connection:info`
- [x] Forward WS `toast` messages to renderer via `webContents.send("toast", …)`
- [x] Type the preload / `window.coosy` surface (`coosy-api.ts` + `env.d.ts`)
- [x] On `sources:open` → `SourceHost.showSource` + SQLite `touchSource` / `last_active_source`
- [x] On `launcher:show` → `SourceHost.showLauncher` + pause active source

### 2.2 SourceHost completion

- [x] Wire `MediaSource.bindInput` → `webContents.sendInputEvent` (keydown/keyup)
- [x] Resize/bounds sync (bottom 72px chrome for toasts / Home)
- [x] Broadcast WS `context` when active source changes
- [x] Pause previous source before switch

### 2.3 WebSocket server

- [x] Command path source-agnostic
- [x] `nav` forwarded to renderer via IPC
- [x] Pairing gate: 6-digit code in SQLite; `hello` requires code or trusted `clientId`
- [x] Reconnect-friendly `hello` / `hello-ack`

### 2.4 Discovery & pairing UX (TV side)

- [x] Show LAN IP + port on home
- [x] Pairing code on home (PRD flow D)
- [x] mDNS advertisement (`discovery.ts`)

### 2.5 Local HTTP

- [-] Full PWA hosting for `packages/remote` — deferred / other repo
- [x] WS smoke script instead of HTTP remote for POC

---

## 3. Netflix source

- [x] Key-event translation + Electron keyCode mapping
- [x] Honest `CommandResult` when unbound / unsupported
- [x] `persist:netflix` partition (session persistence — validate manually after login)
- [x] `supportsNowPlayingMetadata: false`
- [ ] Live player validation on a real Netflix stream (manual)

---

## 4. TV launcher UI (renderer)

- [x] `HomeScreen` loads sources via `window.coosy.listSources()`
- [x] Labels from `MediaSource` metadata
- [x] `LoadingScreen` while opening
- [x] `PlayerOverlay` chrome + toasts from IPC
- [x] D-pad / keyboard focus model + phone `nav` on home
- [x] `ContinueCard` empty / hidden (no fake data)

---

## 5. Shared package

- [x] Optional `SourceInput` / `bindInput` on `MediaSource`
- [x] Wire types used by desktop IPC + WS
- [x] `@coosy/shared` builds as dependency of desktop

---

## 6. POC acceptance checklist

- [x] App builds (`pnpm --filter @coosy/desktop build`)
- [x] Typecheck clean
- [x] App launches fullscreen to CoOSy home (smoke: WS + pairing + Widevine ready)
- [ ] Netflix tile opens Netflix in partitioned `WebContentsView`
- [ ] Login once → stays logged in after quit/relaunch
- [ ] WS smoke: `toggle-play-pause` / seek / volume → `command-result`
- [ ] TV toast reflects actual `CommandResult.ok`
- [ ] Home returns without destroying Netflix view; re-open resumes
- [x] Widevine: components ready log (playback checklist still open in spike doc)
- [x] Architecture rule: no source-specific logic outside `src/main/sources/`

---

## 7. Explicitly deferred (not POC)

- [-] Continue Watching shelf / DOM scraping (v1.5)
- [-] System-level volume API
- [-] Phone trackpad + keyboard fallback UX
- [-] YouTube / Prime / Hotstar sources
- [-] Go WebSocket sidecar
- [-] Autostart on boot / crash recovery
- [-] Multi-user / multi-room
- [-] `packages/remote` implementation

---

## How to run

```bash
pnpm install
pnpm --filter @coosy/shared build
pnpm --filter @coosy/desktop exec electron-builder install-app-deps   # better-sqlite3 ↔ ECS
pnpm dev
```

Smoke the WS path (pairing code is shown on the TV home footer):

```bash
node packages/desktop/scripts/ws-smoke.mjs ws://127.0.0.1:17832 <pairing-code>
```
