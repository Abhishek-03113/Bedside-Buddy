# Tasks — Desktop Multi-Source (`packages/desktop`)

Epic tracker for multi-source media integration: Netflix (preserve) + YouTube + Hotstar + Prime Video, with keyboard-navigable Big Picture launcher.

**Sources of truth:** [`docs/PRD.md`](docs/PRD.md), [`docs/architecture.md`](docs/architecture.md), [`tasks-desktop-poc.md`](tasks-desktop-poc.md), [`tasks-desktop-polish.md`](tasks-desktop-polish.md)

**In scope:** `packages/shared` (only if types needed), `packages/desktop`  
**Out of scope:** `packages/remote`, mDNS/pairing expansion, plugin systems, DRM playback automation

## Legend

| Mark | Meaning |
|------|---------|
| `[ ]` | pending |
| `[~]` | in progress |
| `[x]` | done |
| `[-]` | deferred / out of scope for this epic |

## Success bar

1. Home focuses a source tile; arrows move focus across Netflix / YouTube / Hotstar / Prime
2. Enter and Space launch the focused source via one shared activation path
3. Each source has an isolated persistent session partition
4. Source-specific command translation stays inside `sources/<source>/`
5. Netflix behavior unchanged; fullscreen / SourceHost reuse preserved
6. Typecheck / tests / build pass

---

## 1. YouTube source

- [x] `packages/desktop/src/main/sources/youtube/` MediaSource
- [x] Stable id `youtube`, display name, home URL
- [x] `persist:youtube` session partition
- [x] Icon metadata + SourceCapabilities (honest)
- [x] Explicit keyboard / RemoteCommand translation
- [x] No YouTube logic outside the source folder

---

## 2. Hotstar source

- [x] `packages/desktop/src/main/sources/hotstar/` MediaSource
- [x] Stable id `hotstar`, display name, home URL
- [x] `persist:hotstar` session partition
- [x] Icon metadata + SourceCapabilities (honest)
- [x] Explicit Hotstar key mapping (not a blind Netflix copy)

---

## 3. Prime Video source

- [x] `packages/desktop/src/main/sources/prime/` MediaSource
- [x] Stable id `prime`, display name, home URL
- [x] `persist:prime` session partition
- [x] Icon metadata + SourceCapabilities (honest)
- [x] Explicit Prime key mapping (not a blind Netflix copy)

---

## 4. Registry

- [x] Register Netflix, YouTube, Hotstar, Prime in static lookup table
- [x] No plugin / DI / config-driven loading

---

## 5. Launcher keyboard navigation

- [x] Arrow Up / Down / Left / Right move focus across spatial grid
- [x] Visible focus; focus never lost; deterministic wrap/clamp
- [x] Navigation not hardcoded to exactly four tiles
- [x] Mouse click still works
- [x] Renderer owns focus state (not main / SourceHost)

---

## 6. Enter / Space activation

- [x] Single `activateFocusedSource()` path
- [x] Enter and Space both use it
- [x] Space `preventDefault` (no launcher scroll)
- [x] Context-aware: launcher vs active media WebContentsView
- [x] Preserve Cmd/Ctrl+Escape → Home

---

## 7. Focus model

- [x] Sensible default focus on Home launch
- [x] Restore previous focused tile after returning Home
- [x] Fallback to first source if previous id missing
- [x] Focus does not leak into media WebContentsView
- [x] Obvious 10-foot focus styling

---

## 8. SourceTile UX

- [x] Focused / unfocused styling
- [x] Accessible labeling
- [x] Enter / Space activation via parent focus model
- [x] No full launcher redesign

---

## 9. Capabilities & command translation

- [x] Each source declares real capabilities only
- [x] Commands → source `handleCommand` → key translation
- [x] Honest `CommandResult`; no source branching in ws-server / SourceHost

---

## 10. Session isolation & switching

- [x] Distinct `persist:*` partitions per source
- [x] SourceHost works with four sources (pause / hide / reuse / bounds) — existing source-agnostic path; registry now returns four
- [x] No Netflix fullscreen regression from this epic’s code path (no SourceHost bounds changes)
- [x] Loading / failure paths do not crash launcher (`openSource` catch → home)

---

## 11. Testing

- [x] Registry contains all four sources + metadata / partitions / capabilities
- [x] Per-source command mapping tests
- [x] Launcher focus navigation + Enter/Space + restore-home tests
- [x] Typecheck + tests + build green
- [-] Automated DRM / live playback validation

---

## 12. Cleanup

- [x] Remove only dead code left by this epic (none destructive; no obsolete nav paths left)
- [x] Preserve useful remote / WS / discovery code

---

## Definition of Done checklist

- [x] CoOSy opens Home with a visibly focused tile (code path)
- [x] Arrows navigate Netflix / YouTube / Hotstar / Prime (code path)
- [x] Enter launches focused source
- [x] Space launches focused source
- [x] Isolated persistent sessions per source
- [x] Netflix intact; source-specific translation isolated
- [x] Typecheck / tests / build pass
- [x] Task tracker updated with what was implemented
- [ ] Manual browser/DRM playback left unchecked (not claimed from compile/tests)

---

## Implementation notes

### What was implemented

**Sources (isolated under `sources/<name>/`):**

| Source | id | URL | Partition | Play/pause | Seek | Volume | Next |
|--------|----|-----|-----------|------------|------|--------|------|
| Netflix | `netflix` | netflix.com | `persist:netflix` | Space | ←/→ | ↑/↓ | KeyN |
| YouTube | `youtube` | youtube.com | `persist:youtube` | KeyK | J/L | ↑/↓ | unsupported (needs Shift+N) |
| Hotstar | `hotstar` | hotstar.com | `persist:hotstar` | Space | ←/→ | ↑/↓ | unsupported |
| Prime | `prime` | primevideo.com | `persist:prime` | Space | ←/→ | ↑/↓ | unsupported |

**Registry:** static `SOURCES` table only — four entries.

**Launcher:**
- Pure focus helpers in `renderer/launcher-focus.ts` (column-aware wrap nav, restore, clamp)
- `HomeScreen.activateFocusedSource()` shared by Enter + Space
- `App` remembers `lastFocusedSourceId` and passes `initialFocusSourceId` on return Home
- SourceTile: roving tabindex, aria-label, stronger 10-foot focus ring
- Grid column count from live `ResizeObserver` + CSS `grid-template-columns`

**Infrastructure touch (generic only):**
- Extended `mapToElectronKeyCode` for KeyJ/K/L (needed by YouTube; not source branching)
- Vitest include expanded to `src/renderer/**/*.test.ts`

**Unchanged / preserved:**
- Netflix command mapping and capabilities
- SourceHost lifecycle / fullscreen bounds / Cmd+Ctrl+Escape
- ws-server source-agnostic dispatch
- shared protocol
- remote / discovery / pairing code

### Architecture check

Adding sources required changes only to:
1. source implementations
2. source registry
3. generic launcher focus / tile rendering

No source-specific branches in `ws-server.ts`, `SourceHost` control flow, or shared WS protocol.

### Manual validation remaining

- [ ] Visual: four tiles + keyboard focus on real display
- [ ] Login isolation across Netflix / YouTube / Hotstar / Prime
- [ ] Session persistence after quit/relaunch per partition
- [ ] Source switching pause/hide/reuse with four live views
- [ ] Live keyboard control inside each service’s player
- [ ] Widevine/DRM playback on Hotstar / Prime (and existing Netflix)
