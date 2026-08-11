# Task — Mobile Remote UI

Second milestone: make the phone remote genuinely usable — mobile layout, working launcher/media navigation, scroll, search, compact toast, and honest state sync.

**Sources of truth:** this file, [`task-mobile-remote-foundation.md`](task-mobile-remote-foundation.md), [`docs/architecture.md`](docs/architecture.md), shared WS protocol.

## Legend

| Mark | Meaning |
|------|---------|
| `[ ]` | pending |
| `[~]` | in progress |
| `[x]` | done |
| `[-]` | deferred |

---

## Scope

- Mobile-first remote layout (touch targets, portrait, safe viewport).
- Launcher D-pad / Select / Home / Back actually drive the desktop.
- When a source is active: scroll, browse-focus navigation, Select to open/play, generic search.
- Compact toast feedback that does not block controls.
- Reflect desktop connection / mode / source / command results (no faked local state).
- Tests + typecheck + build.

**Out of scope:** source-specific remote UIs, Continue Watching on phone, PWA packaging, rewriting desktop host architecture, claiming phone-validated UX without a real device test.

---

## Architectural decisions

1. **Reuse protocol** — keep `hello` / `nav` / `command` / `context` / `toast` / `command-result`. Extend `RemoteCommand` with generic `scroll`, `navigate`, `activate`, `search` only.
2. **Mode-aware remote** — launcher: D-pad/Select/Home/Back via `nav`. Player: Home/Back via `nav`; D-pad/OK/scroll/search via `command` so `MediaSource` interprets them.
3. **No source branches in remote UI/server** — search URLs and key maps live only in each `MediaSource`. Unsupported → honest `{ ok: false, reason: "unsupported" }`.
4. **Capabilities** — declare `supportsScroll`, `supportsSearch`, `supportsBrowseNavigate` so the phone enables/disables chrome without probing.
5. **Toast** — single feedback slot + CSS auto-dismiss; no toast stack / heavy state machine.
6. **Focused item label** — not in context payload yet; deferred unless desktop starts broadcasting it.

---

## Implementation tasks

### Protocol / shared

- [x] Extend `RemoteCommand` with scroll / navigate / activate / search
- [x] Extend `SourceCapabilities` for scroll / search / browse-navigate
- [x] Keep WS envelope unchanged aside from command payloads

### Desktop (minimal — no rewrite)

- [x] Map new commands in Netflix / YouTube / Prime / Hotstar translators
- [x] Search via `SourcePage.navigate` where URL search is known; else unsupported (Hotstar)
- [x] Ensure `Enter` / `PageUp` / `PageDown` map in `SourceHost`
- [x] Confirm launcher `nav` → HomeScreen focus / select / home path still works (unchanged path)

### Mobile UI

- [x] Phone layout: large targets, one-handed D-pad + media cluster, safe-area, no accidental zoom/scroll on controls
- [x] Search action + query entry
- [x] Scroll controls in player mode
- [x] Compact blended toast with auto-dismiss
- [x] Status: connection, mode, active source, command success/failure from desktop

### Tests / validation

- [x] Command translator + search handling tests
- [x] Remote UI / client tests: nav, select, home/back, scroll, search, context, toast lifecycle
- [x] `pnpm typecheck` / `pnpm test` / build
- [ ] Manual phone validation (required — do not mark UX validated until done)

---

## Progress

**Status:** implementation complete; **manual phone validation still required**.

---

## Completed work

- Shared: `RemoteCommand` + `SourceCapabilities` extended for browse/scroll/search
- Desktop: per-source key maps + search URL helpers; `SourceHost` Enter/PageUp/PageDown
- Remote: mobile layout (`styles.css` / viewport), mode-aware `resolveControlAction`, search sheet, scroll row, compact toast (`useRemoteToast`)
- Tests: remote-actions, ws context/toast, command translators, remote-server scroll/search/home
- Builds: `@coosy/shared`, `@coosy/remote`, `@coosy/desktop` green

---

## Remaining tasks

- [ ] Manual validation on a real phone (same Wi-Fi as laptop)
- [ ] Optional polish after phone feedback (spacing, search keyboard UX)

---

## Deferred work

- Focused item title/label on phone (needs desktop context field)
- Source-specific search UIs / DOM scrapers
- Hotstar generic search URL (currently honest `unsupported`)
- Gesture pad / keyboard / trackpad
- Installable PWA
- QR / richer discovery UX

---

## Known limitations

- Mobile UX is **not** claimed validated — unit/build only so far.
- Browse arrows on a source page share the same keys sites use for seek/volume while a video player has focus; site context decides behavior.
- Hotstar search returns `unsupported` until a reliable search URL exists.
- Focused media title is not synced to the phone yet.
- Search depends on each source’s web search URL remaining stable.

---

## Manual phone validation required

1. Open laptop Phone URL on a real phone (same Wi-Fi); pair.
2. Launcher: D-pad moves focus; OK opens source; Home/Back from source returns to launcher.
3. In source: scroll, D-pad browse, OK opens/plays, Search runs a query (or shows unsupported honestly).
4. Toast appears briefly and does not block buttons; disconnect/reconnect updates status.
