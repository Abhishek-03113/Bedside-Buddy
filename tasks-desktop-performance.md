# Tasks — Desktop Performance & Responsiveness (`packages/desktop`)

Epic tracker for an objective performance/optimization pass on CoOSy Desktop.
Goal: reduce measurable latency, unnecessary work, and resource consumption — not subjective “feels faster” claims.

**Sources of truth:** [`docs/PRD.md`](docs/PRD.md), [`docs/architecture.md`](docs/architecture.md), [`tasks-desktop-poc.md`](tasks-desktop-poc.md), [`tasks-desktop-polish.md`](tasks-desktop-polish.md), [`tasks-desktop-multi-source.md`](tasks-desktop-multi-source.md)

**In scope:** `packages/desktop` (targeted fixes), light `packages/shared` only if types needed  
**Out of scope:** new media sources, phone PWA, mDNS/pairing expansion, WS expansion, architecture rewrite, random Chromium flags, DRM/CDM internals, new state-management frameworks

## Legend

| Mark | Meaning |
|------|---------|
| `[ ]` | pending |
| `[~]` | in progress |
| `[x]` | done |
| `[-]` | deferred / out of scope for this epic |

## Success bar

1. Baseline documented with concrete measurable findings (renders, IPC, bounds, listeners, DB)
2. Launcher hot path does not recalculate grid / rebuild source metadata on every keypress
3. SourceHost bounds/show/hide/switch operations are idempotent where safe
4. Launcher renderer is quiet while a source owns the screen
5. Toast overlay is reused (create once → update → show/hide)
6. Focus navigation does not touch SQLite
7. Persistent source views stay at 1 per source (no accumulation)
8. Typecheck / tests / build pass
9. Manual UX validation left to human (not claimed solved by agent)

---

## 0. Hard constraints checklist

- [x] No new media sources
- [x] No phone PWA / mDNS / WS expansion
- [x] No architecture rewrite / no new state framework
- [x] Preserve Netflix / YouTube / Hotstar / Prime, Widevine, sessions, SourceHost reuse, keyboard nav

---

## 1. Establish performance baseline

- [x] Inspect React render / effect / listener hot paths
- [x] Inspect IPC / SourceHost / ResizeObserver / timers
- [x] Inspect DB / filesystem / logging on hot paths
- [x] Add minimal development-only counters (`COOSY_PERF=1` → `src/shared/perf.ts`)
- [x] Document baseline findings in this file (§ Findings)

---

## 2. Optimize launcher hot path

- [x] Source metadata stability (session bootstrap cache; no rebuild per keypress)
- [x] Grid geometry not recalculated on every keypress (columns in ref; ResizeObserver only)
- [x] Focus updates only necessary state (`focusIndex`)
- [x] Pure/cheap navigation helpers; stable `KEY_TO_NAV` map
- [x] Avoid unnecessary effects on focus change (listeners no longer recreated)
- [x] Memoization only where data flow justifies it (`SourceTile` + stable handlers)

---

## 3. Keyboard event handling

- [x] Inventory all key listeners (count, registration site, recreate-on-render?)
- [x] Ensure no duplicate / multi-layer processing of same key
- [x] LAUNCHER: arrows navigate; Enter/Space activate
- [x] ACTIVE SOURCE: media keys to WebContentsView; Cmd/Ctrl+Escape → Home
- [x] No artificial debounce/throttle on navigation

---

## 4. Source tile rendering

- [x] Measure whether focus change rerenders every tile (yes, before memo)
- [x] Isolate focus state; keep metadata stable; memo unfocused tiles
- [x] Do not redesign launcher

---

## 5. ResizeObserver / layout calculation

- [x] ResizeObserver updates column ref only when column count changes
- [x] No layout measurement on every keyboard event
- [x] Avoid forced synchronous layout where practical (no keypress layout reads)

---

## 6. SourceHost hot paths

- [x] Idempotent showSource / showLauncher / createSourceView / syncBounds
- [x] Skip identical setBounds (`rectsEqual` + `lastSyncedBounds`)
- [x] Skip redundant show/hide when already attached/active
- [x] Skip source-switch logic when active source unchanged (noop path)
- [x] No repeated BrowserWindow lookups beyond need
- [x] No listener accumulation on switch (escape hooks still once per source id)

---

## 7. Window resize / bounds sync

- [x] Only active source gets necessary updates
- [x] Identical bounds ignored
- [x] Resize handlers registered once + cleaned up
- [x] No React/IPC required for native bounds updates

---

## 8. IPC boundaries

- [x] Inventory: Event | Caller | Receiver | Frequency | Purpose
- [x] Remove/avoid IPC on every focus movement / every tile render / Home remount
- [x] Keep IPC required for future remote architecture

---

## 9. Active-source renderer quietness

- [x] HomeScreen unmounts while player active (ResizeObserver / keydown gone)
- [x] Do not throttle media WebContentsView (`backgroundThrottling: false` on source views)
- [x] Launcher `webContents.setBackgroundThrottling(true)` while source active (preserved)

---

## 10. Toast overlay lifecycle

- [x] Confirm create-once / reuse / show / hide (already correct; kept)
- [x] No per-toast BrowserWindow creation
- [x] Skip identical overlay bounds; clear on dispose

---

## 11. Database / filesystem

- [x] Focus navigation never touches SQLite (confirmed — no DB in renderer nav path)
- [x] `setAppState` skips write when value unchanged; showSource noop skips touch/DB
- [x] Persistence preserved

---

## 12. Memory / resource lifecycle

- [x] Dev counters: view create / attach / detach / setBounds / listeners
- [x] Verify 1 view per source on repeated switch (code + lifecycle tests)
- [x] No BrowserWindow / listener / observer accumulation (toast reuse; escape hook once)

---

## 13. CSS objective cost

- [x] Audit filters / blur / shadows / layout-triggering animations
- [x] No CSS change — focus glow/scale are intentional polish; cost is limited to 2 tiles animating on focus change

---

## 14. Electron configuration

- [x] Audit BrowserWindow / WebContentsView config
- [x] No config change (see § Electron audit) — no random Chromium flags

---

## 15–16. Targeted fixes

- [x] Implement smallest safe fixes from findings
- [x] Document BEFORE / AFTER / IMPACT per meaningful optimization

---

## 17. Regression tests

- [x] Existing: focus nav, Enter/Space, registry, commands, SourceHost reuse, viewport, transitions
- [x] Added: `rectsEqual`, bootstrap cache, SourceHost lifecycle contracts, repeated nav purity

---

## 18. Cleanup

- [x] No obsolete experiments left; perf counters gated behind `COOSY_PERF=1`
- [x] Unused imports / dead paths cleaned in touched files
- [x] Preserve WS / discovery / pairing / remote-facing infrastructure

---

## 19. Validation (agent)

- [x] typecheck
- [x] tests (30 passed)
- [x] build
- [x] counter / lifecycle evidence from instrumentation + tests

---

## 20. Final report

- [x] See bottom of this file + chat response

---

## Findings (baseline)

### Launcher (before)

| Finding | Evidence |
|---------|----------|
| Arrow key rebuilt `applyNav` → tore down + re-registered `keydown` + `onNav` every focus change | `applyNav` deps included `activateFocusedSource` → `focusIndex` |
| Every focus change re-rendered HomeScreen + all 4 SourceTiles | no memo; new `onSelect` closures per tile per render |
| Source metadata not rebuilt per keypress | already OK — loaded once via IPC |
| Grid columns already in a ref (not React state) | already OK — but ResizeObserver always wrote ref even when unchanged |
| Focus effect depended on `[focusIndex, sources]` and always called `focus()` | extra work when `sources` identity changed |
| Returning Home remounted HomeScreen → 2 IPC invokes every time | `listSources` + `getConnectionInfo` on every mount |

### Keyboard inventory

| Listener | Where | Before | After |
|----------|-------|--------|-------|
| `window.keydown` | HomeScreen | recreated every focus change | once per HomeScreen mount |
| `coosy.onNav` | HomeScreen | recreated every focus change | once per HomeScreen mount |
| `coosy.onContext` | App | once | once (unchanged) |
| `coosy.onNav` (home/back) | App when `screen===player` | once per player entry | unchanged |
| `before-input-event` Cmd/Ctrl+Esc | SourceHost per source | once per source id | unchanged |

### IPC inventory

| Event | Caller | Receiver | Frequency | Purpose |
|-------|--------|----------|-----------|---------|
| `sources:list` | HomeScreen bootstrap | main | once/session (cached) | source metadata |
| `connection:info` | HomeScreen bootstrap | main | once/session (cached) | pairing footer |
| `sources:open` | tile activate | main | per activation | show source |
| `launcher:show` | go home | main | per home return | detach source |
| `context` (push) | SourceHost | App | per transition | sync screen mode |
| `nav` (push) | WS remote | HomeScreen/App | remote only | remote d-pad |
| `toast` (push) | main | renderer or overlay | per toast | feedback |

**Focus movement: no IPC** (confirmed before and after).

### SourceHost (before)

| Finding | Evidence |
|---------|----------|
| `syncBounds` always called `setBounds` | no equality check |
| Re-`showSource` of active source re-attached, re-emitted context, re-wrote DB | idempotent path still did full work |
| `showLauncher` when already on launcher still wrote DB + emitted | no early return |
| Escape hooks already once-per-source | OK |
| Resize listeners registered once in ctor | OK |

### Toast (before)

| Finding | Evidence |
|---------|----------|
| Overlay BrowserWindow created once and reused | already OK |
| `setBounds` on every show even if unchanged | no equality check |

### Active source quietness (before)

| Finding | Evidence |
|---------|----------|
| HomeScreen unmounts on player → observers/keydown removed | already OK |
| App keeps `onContext` + player `onNav` | necessary |
| No intervals / rAF / polling in desktop path | confirmed |

### DB (before)

| Finding | Evidence |
|---------|----------|
| Focus nav never touches SQLite | confirmed |
| `setAppState` always wrote even if value identical | no read-compare |
| `touchSource` on every real activation | intentional; skipped on noop reopen |

---

## Optimizations log

### O1 — Stable launcher listeners
- **BEFORE:** Each arrow key → new `applyNav` → remove+add `keydown` + `onNav`
- **AFTER:** Refs hold latest focus/sources/callback; listeners register once per Home mount
- **IMPACT:** Eliminates 2 listener teardown/setup cycles per keypress; reduces missed keys during rebind

### O2 — SourceTile memo + stable handlers
- **BEFORE:** Focus change re-rendered all 4 tiles (new `onSelect` lambdas)
- **AFTER:** Stable `handleSelect` / `handleFocusRequest`; `memo(SourceTile)` skips unchanged tiles
- **IMPACT:** ~2 tile renders per nav step instead of 4 (plus HomeScreen still renders once for focus state)

### O3 — Session bootstrap cache
- **BEFORE:** Every Home remount → 2 IPC invokes
- **AFTER:** `loadLauncherBootstrap()` caches sources + connection for the session
- **IMPACT:** Home ← source → Home no longer pays list/connection IPC

### O4 — Idempotent SourceHost bounds
- **BEFORE:** Every sync/`showSource`/resize called `setBounds` unconditionally
- **AFTER:** `rectsEqual(lastSyncedBounds, next)` skips identical updates
- **IMPACT:** Fewer Chromium view geometry updates during resize storms and redundant show calls

### O5 — Idempotent showSource / showLauncher
- **BEFORE:** Re-open active source re-attached, re-emitted, re-wrote DB; double showLauncher wrote DB
- **AFTER:** Noop path when already active+attached; early return when already on launcher
- **IMPACT:** Less main-process work, fewer context broadcasts, fewer SQLite writes

### O6 — setAppState skip-if-unchanged
- **BEFORE:** Identical key/value still executed INSERT UPSERT
- **AFTER:** Read-compare then write
- **IMPACT:** Avoids redundant SQLite UPSERTs

### O7 — Toast bounds skip
- **BEFORE:** Every toast `setBounds`
- **AFTER:** Skip when geometry unchanged
- **IMPACT:** Less overlay window churn on repeated toasts

### O8 — ResizeObserver column write guard
- **BEFORE:** Always assigned `columnsRef` (no React state, but noisy)
- **AFTER:** Only update ref + counter when column count changes
- **IMPACT:** Clearer semantics; counters show real column changes

---

## Electron audit (no change)

1. **Current:** Main window `backgroundThrottling: true`; source views `false`; `plugins: true`; castlabs Widevine build; no extra Chromium flags
2. **Why it may be expensive:** N/A for flags — throttling launcher while source is active is intentional
3. **Proposed change:** none
4. **Possible regression:** N/A
5. **Why safe:** existing polish pass already set this correctly

---

## IPC note (focus)

Focus navigation remains renderer-local. Remote `nav` IPC retained for future phone control.
