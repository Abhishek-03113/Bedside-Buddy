# Tasks — Desktop Polish (`packages/desktop`)

Epic tracker for making the CoOSy desktop shell feel like a polished Big Picture-style media surface after the functional Netflix POC.

**Sources of truth:** [`docs/PRD.md`](docs/PRD.md), [`docs/architecture.md`](docs/architecture.md), [`docs/widevine-spike.md`](docs/widevine-spike.md), [`tasks-desktop-poc.md`](tasks-desktop-poc.md)

**In scope:** `packages/shared` (only if types needed), `packages/desktop`  
**Out of scope:** phone PWA, mDNS/pairing UX expansion, Go sidecar, additional streaming services

## Legend

| Mark | Meaning |
|------|---------|
| `[ ]` | pending |
| `[~]` | in progress |
| `[x]` | done |
| `[-]` | deferred / out of scope for this epic |

## Success bar

1. Netflix occupies the intended fullscreen content viewport (no dark top strip, no permanent bottom CoOSy bar)
2. Temporary CoOSy UI is overlay-only and does not permanently reserve layout space
3. Source switching reuses views; no listener/view accumulation
4. CoOSy renderer stays quiet while a source is active
5. Widevine/DRM/session behavior preserved
6. Typecheck/build/tests pass

---

## 0. Investigation (before large changes)

- [x] Inspect SourceHost bounds / chrome reservation (`72px`)
- [x] Inspect PlayerOverlay + CSS layout model
- [x] Inspect window creation, Widevine, WS, discovery load while idle
- [x] Identify why React toasts cannot sit above a fullscreen sibling `WebContentsView` without an overlay surface
- [ ] Manual visual check after fix (screenshot parity)

---

## 1. Netflix viewport / fullscreen

- [x] Full-bleed source bounds (no permanent 72px chrome reservation)
- [x] Eliminate dark top strip (contentView-relative bounds + hidden title bar + fullscreen)
- [x] Eliminate bottom CoOSy bar from active source experience
- [x] Resize sync on window size changes (no stale bounds)
- [x] Launcher vs source never overlap incorrectly

---

## 2. Performance investigation & fixes

- [x] Audit WebContentsView / BrowserWindow config
- [x] Audit Chromium flags (none added blindly — none introduced)
- [x] Throttle launcher webContents while source is active
- [x] Avoid unnecessary React work / permanent player chrome while source active
- [x] Confirm no polling timers in desktop path (none found; toast timers are event-driven)
- [x] Document ECS/VMP quality caveats (not CoOSy workarounds)

---

## 3. Electron window / renderer foundation

- [x] Lightweight main process while Netflix plays
- [x] Event-driven toasts (no continuous render)
- [x] IPC listeners registered once / cleaned up
- [x] Keep WS + mDNS compiling; do not expand remote product work
- [x] Useful but non-noisy logging (unchanged; no extra spam added)

---

## 4. Harden SourceHost

- [x] Idempotent `showSource` / `showLauncher`
- [x] View reuse; no unnecessary destroy
- [x] Pause previous source before switch
- [x] Destroyed/invalid view recovery
- [x] Single resize handler; dispose cleans listeners + attached state
- [x] Deterministic bounds from content viewport helper
- [x] Home from focused source view via Cmd/Ctrl+Escape (does not steal bare Escape)

---

## 5. Separate source content vs CoOSy chrome

- [x] Application/launcher surface
- [x] Active source surface (primary when playing)
- [x] Temporary overlays (toast) — no permanent layout reservation
- [x] Remove player footer chrome dependency from viewport math

---

## 6. Source transitions

- [x] Home → Netflix
- [x] Netflix → Home
- [x] Netflix → Netflix (reopen / relaunch path)
- [x] Future source switch shape (reuse + pause) without flash where practical

---

## 7. POC screenshot issues

- [x] Dark strip above Netflix (layout model fixed; confirm manually)
- [x] Bottom horizontal CoOSy bar
- [x] Netflix not feeling fullscreen
- [x] CoOSy chrome interrupting stream

---

## 8. Remove debug/POC UI from active source

- [x] Persistent player footer / “Remote connected · {sourceId}”
- [x] Keep pairing IP/code on **home** only (product flow)
- [x] Diagnostics remain in logs / dev tooling

---

## 9. Cleanup after refactor

- [x] Remove obsolete `72px` layout coupling
- [x] Remove dead player-chrome CSS/components if unused
- [x] No destructive deletion of useful remote/WS/discovery code

---

## 10. Regression coverage

- [x] Viewport bounds helper tests
- [x] SourceHost transition / reuse state helper tests (`nextHostState`)
- [x] Netflix command translation smoke test
- [x] Typecheck + build green

---

## 11. Explicitly deferred

- [-] Phone PWA / remote UI
- [-] mDNS improvements / reconnect UX
- [-] Advanced pairing UX
- [-] Go WebSocket sidecar
- [-] Additional streaming services
- [-] Automated Netflix DRM playback tests

---

## Definition of Done checklist

- [x] Netflix fullscreen viewport clean (code-level; manual confirm remaining)
- [x] Dark top strip eliminated (code-level; manual confirm remaining)
- [x] Bottom CoOSy bar eliminated while source active
- [x] Overlays do not permanently consume layout
- [x] Source switching does not recreate views unnecessarily
- [x] WebContentsView lifecycle robust
- [x] No listener/view accumulation on repeated switches
- [x] Launcher/source bounds deterministic
- [x] Minimal renderer work while Netflix active
- [x] Widevine/session preserved
- [x] Dead code from this refactor cleaned (useful code kept)
- [x] Tests/typecheck/build pass

---

## Implementation notes

### Findings

- **Root cause of non-fullscreen Netflix:** `SourceHost.syncBounds` reserved `height - 72` for PlayerOverlay chrome; React painted a permanent bottom bar in that gap.
- **Top dark strip contributors:** content bounds not always synced from `contentView`; native title strip risk; under-paint of launcher `#0a0a0a` when source view was short.
- **Toast layering:** React toasts in the launcher `webContents` cannot appear above a fullscreen sibling `WebContentsView`, and CSS `pointer-events: none` does not pass hits to the view below → temporary `ToastOverlay` BrowserWindow.
- **Slow Netflix open:** `showSource` awaited `webContents.loadURL()` (full document load) before attaching the view / resolving IPC, and the renderer blocked on a CoOSy "Loading…" screen for that entire time. Fixed by attach-first + background `warmSources()`.
- **Pairing footer on Home** is product flow (PRD), not debug — kept on launcher only.
- **No Chromium flag soup** in repo; left untouched.
- **Perceived Netflix quality** may still be limited by ECS **development** VMP signing (see `docs/widevine-spike.md`) — document, don’t hack DRM/CDM paths.
- **No polling timers** in the desktop hot path; discovery/WS are event-driven.

### What changed

- Full-bleed `computeSourceViewportBounds` + SourceHost attach/detach/reuse hardening
- Removed permanent player chrome; player renderer is an empty surface
- Main-process toast overlay while a source is active
- Context IPC so Escape/host transitions keep React screen state in sync
- Launcher `backgroundThrottling` while source owns the screen
- Source views: opaque black background, `backgroundThrottling: false`
- Cmd/Ctrl+Escape → home (bare Escape left for Netflix)
- **Fast open:** attach-first (no await on Netflix `loadURL`); `warmSources()` preloads in background; removed CoOSy Loading gate
- Vitest coverage for viewport + host state helpers + Netflix key map

### Dead code removed

- `player-chrome` CSS and permanent Home/footer UI in `PlayerOverlay`
- Hard-coded `72` chrome constant from SourceHost bounds

### Manual validation remaining

- [ ] Visual: no top strip / no bottom bar with Netflix open (compare to prior screenshot)
- [ ] Netflix interaction feel after polish
- [ ] Home ↔ Netflix repeated switches (view retained, session kept)
- [ ] Remote command toast appears briefly over Netflix without eating layout
- [ ] Cmd/Ctrl+Escape returns to launcher
- [ ] Widevine playback still works on this machine (ECS/VMP caveats apply)
