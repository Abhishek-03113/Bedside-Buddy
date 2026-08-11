# Task — Remote Media Selection

Allow the phone remote to navigate and select media inside the active Netflix / YouTube / Hotstar / Prime UI — without mirroring streaming UIs on the phone.

**Sources of truth:** this file, [`task-mobile-remote-ui.md`](task-mobile-remote-ui.md), [`docs/architecture.md`](docs/architecture.md), shared WS protocol.

## Legend

| Mark | Meaning |
|------|---------|
| `[ ]` | pending |
| `[~]` | in progress |
| `[x]` | done |
| `[-]` | deferred |

---

## Scope

- Generic `select` remote command: phone → WebSocket → desktop → active `MediaSource`.
- Per-source Enter/click mapping inside `sources/<source>/` only.
- D-pad UP/DOWN/LEFT/RIGHT → launcher nav when launcher active; → source browse when a media source is active.
- Clear primary SELECT button on the phone remote + toast command feedback.
- Search → D-pad → SELECT → open/play; BACK/HOME keep existing behavior.
- Honest `CommandResult` when selection is unsupported.
- Tests + typecheck + build.

**Out of scope:** scraping/rebuilding streaming UIs on the phone, rewriting remote protocol or desktop host architecture, claiming phone-validated UX without a real device test.

---

## Architectural decisions

1. **Reuse dispatch** — `select` is a generic `RemoteCommand` (renamed from interim `activate`); remote server stays source-agnostic.
2. **Mode-aware phone** — launcher: D-pad/SELECT via `nav`; player: D-pad/`select` via `command` so `MediaSource` interprets them. Home/Back always `nav`.
3. **Mappings stay in sources** — each translator maps `select` → Enter (or returns `null` → `{ ok: false, reason: "unsupported" }`).
4. **Phone is a remote** — desktop `WebContentsView` remains source of truth; no Netflix/YouTube/etc. UI on the phone.
5. **Capabilities** — `supportsBrowseNavigate` gates browse chrome; never fake success.

---

## Implementation tasks

### Protocol / shared

- [x] Add generic `RemoteCommand.select` (replaced interim `activate` name)
- [x] Keep existing `navigate` / `scroll` / `search` and WS envelope
- [x] Capabilities already declare `supportsBrowseNavigate`

### Desktop

- [x] Map `select` → Enter in Netflix / YouTube / Prime / Hotstar translators
- [x] Reuse existing `SourceHost` Enter key path
- [x] Preserve play/pause/seek/volume mappings
- [x] Launcher `nav` path unchanged when no source is active

### Mobile UI

- [x] Emphasize SELECT as primary D-pad action (large target, clear label)
- [x] Mode-aware D-pad forwarding (`resolveControlAction`)
- [x] Toast after successful / failed commands
- [x] Search sheet + scroll controls for browse flow

### Tests / validation

- [x] `select` protocol / dispatch (`remote-server.test.ts`)
- [x] Source-specific selection mapping (per-source translators + `browse-select.test.ts`)
- [x] D-pad forwarding + launcher vs player context (`remote-actions.test.ts`)
- [x] Unsupported selection / actions → honest `CommandResult`
- [x] Command result propagation
- [x] `pnpm typecheck` / `pnpm test` / `pnpm build`
- [ ] Manual phone validation (required)

---

## Progress

**Status:** implementation complete; **manual phone validation still required**.

---

## Completed work

- Shared: `RemoteCommand.select` (replaces interim `activate`)
- Desktop: all four sources map `select` → Enter; existing browse/search/scroll preserved
- Remote: mode-aware D-pad/`select`; primary **SELECT** button; toast feedback unchanged
- Tests: remote-actions launcher vs player, remote-server select/navigate/unsupported, browse-select source handling
- Builds: `@coosy/shared`, `@coosy/remote`, `@coosy/desktop` green

---

## Remaining tasks

- [ ] Manual validation on a real phone (same Wi-Fi as laptop)

---

## Deferred work

- Focused item title/label on phone (needs desktop context field)
- Source-specific DOM click targets beyond Enter (only if Enter proves insufficient on-device)
- Hotstar generic search URL (still honest `unsupported`)
- Phone mirror / scraped streaming UI (explicitly out of scope)

---

## Known limitations

- Mobile UX is **not** claimed validated — unit/build only so far.
- Browse arrows share the same keys sites use for seek/volume while a video player has focus; site context decides behavior.
- Hotstar search returns `unsupported` until a reliable search URL exists.
- Focused media title is not synced to the phone yet.

---

## Manual phone validation required

1. Netflix: Search → D-pad results → SELECT opens/plays video
2. YouTube: Search → D-pad results → SELECT opens/plays video
3. Hotstar / Prime: same flow where browse/search is supported; unsupported actions fail honestly
4. D-pad feels responsive while browsing
5. SELECT is obvious and activates the focused item
6. Back / Home still return to launcher / prior nav behavior
7. **Trackpad**: Movement, tap-to-click, and two-finger scroll work on active source
8. **Keyboard**: Text input focuses active input fields, special keys (Enter, Esc, etc.) work correctly

---

## Trackpad & Keyboard Fallback (Added)

**Scope:**
- Implement pointer (move, scroll, click) and text input commands from phone.
- Render Trackpad UI on phone remote and route events to active desktop source.
- Add Keyboard fallback for entering text and special keys.

**Status:** Implementation complete.
- [x] Shared generic commands for pointer and keyboard (`pointer-move`, `text-input`, etc.)
- [x] Phone UI with Trackpad / D-pad toggle and Keyboard modes
- [x] Desktop input routing via `SourceHost`
- [x] Native build fix (`node-gyp` update via pnpm overrides)
- [x] Typecheck and build green
- [ ] Manual validation on a real phone for pointer/keyboard
