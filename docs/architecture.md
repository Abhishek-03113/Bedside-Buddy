# CoOSy v1 — Architecture

## 1. Purpose of this doc

This defines **one seam** in the codebase: the boundary between "app infrastructure" (Electron shell, WebSocket server, React UI, SQLite) and "how a specific streaming service is loaded and controlled" (Netflix in v1).

Everything on the infrastructure side is written once and should never need to change when a new source is added later (YouTube, Prime, etc.). Everything on the source side is written per-platform, isolated, and swappable.

This is the entire open/closed strategy for v1. There is no plugin system, no dynamic loading, no config-driven registry. One interface, one real implementation, one trivial lookup table. Anything more than this today would be building for sources that don't exist yet — the YAGNI boundary explicitly rules that out.

---

## 2. The seam: `MediaSource`

### 2.1 What varies per source vs. what doesn't

| Concern | Same across all sources? | Where it lives |
|---|---|---|
| Loading a URL into a `WebContentsView` | Yes — every source is a web page | Infrastructure (`SourceHost`) |
| Window/view lifecycle (create, show, hide, destroy) | Yes | Infrastructure (`SourceHost`) |
| Translating a generic remote command (`play`, `seek+10`) into the concrete action on that page | **No** — Netflix wants a spacebar keypress, another source might want a DOM click, another might want a native `<video>` API call | Per-source (`MediaSource` implementation) |
| Whether "continue watching" / now-playing metadata is even obtainable | **No** — capability-dependent, not guaranteed | Per-source, and optional |
| Session/auth persistence | Yes — Electron's `session.partition` per source handles this uniformly, no per-source code needed | Infrastructure |

The only thing that actually differs per platform is **command translation** and **optional metadata scraping**. That's what the interface captures — nothing else.

### 2.2 The interface

```
MediaSource
├── id: string                     // stable key, e.g. "netflix"
├── displayName: string             // "Netflix"
├── homeUrl: string                 // entry point URL to load on launch
├── sessionPartition: string        // e.g. "persist:netflix" — isolation boundary
├── icon: SourceIcon                // for launcher tile rendering
│
├── handleCommand(command: RemoteCommand): Promise<CommandResult>
│     // Translates a generic command into whatever this source needs:
│     // key event, DOM interaction, etc. Returns whether it succeeded,
│     // so the UI can show an honest toast instead of a fake confirmation.
│
└── capabilities: SourceCapabilities
      // Declares what this source can actually do, so infra never assumes.
```

```
RemoteCommand =
  | { type: "play" }
  | { type: "pause" }
  | { type: "toggle-play-pause" }
  | { type: "seek", deltaSeconds: number }
  | { type: "next-episode" }
  | { type: "volume", direction: "up" | "down" }

CommandResult =
  | { ok: true }
  | { ok: false, reason: "unsupported" | "no-active-session" | "unknown" }

SourceCapabilities = {
  supportsSeek: boolean
  supportsNextEpisode: boolean
  supportsNowPlayingMetadata: boolean   // "continue watching" — optional, see §4
  supportsVolume: boolean
}
```

**Why `handleCommand` returns a result instead of assuming success:** the PRD already flags that keyboard-simulation is the reliable baseline and DOM-based features are fragile. If `NetflixSource` can't confirm a seek actually happened, it should say so — the toast on the TV screen (`remote-toast` in the prototype) should reflect truth, not just "phone sent something." This is a correctness decision, not a nice-to-have: a UI that shows false confirmations is worse than one that shows nothing.

**Why capabilities are declared, not inferred:** the phone remote's UI (which buttons are enabled, e.g. "next episode") should render based on `capabilities`, not based on trying-and-catching. This means when YouTube is added later with different capabilities, the remote UI adapts automatically without a code change — this is the actual payoff of the open/closed structure, not just a theoretical benefit.

---

## 3. Where command translation happens (the load-bearing decision)

**Rule: the WebSocket handler and the React UI never contain source-specific logic. Ever.**

Flow for a phone button press:

```
Phone (React)
  → sends generic RemoteCommand over WebSocket
    e.g. { type: "seek", deltaSeconds: 10 }

Electron main process: WebSocket handler
  → looks up the currently-active MediaSource (by id)
  → calls activeSource.handleCommand(command)
  → does NOT know or care that this is Netflix
  → relays the CommandResult back to the phone + triggers the TV toast

MediaSource implementation (NetflixSource)
  → knows that "seek +10" means "focus the WebContentsView,
     simulate ArrowRight keydown/keyup"
  → this is the ONLY place that knowledge exists in the codebase
```

If this rule holds, adding `YouTubeSource` later means: write a new file implementing `MediaSource`, register it in the lookup table (§5), done. Nothing in `ws-server.ts`, nothing in the React launcher, nothing in the SQLite schema changes. That is the concrete meaning of "open for extension, closed for modification" here — not an abstract principle, but this specific guarantee.

---

## 4. "Continue Watching" is explicitly optional, not deferred-and-forgotten

The PRD flags this as the flakiest feature technically (no public API, DOM-scraping only). The architecture reflects that by making it an **optional capability**, not a required method every `MediaSource` must implement:

```
MediaSource.getNowPlaying?(): Promise<NowPlayingInfo | null>
```

- If `capabilities.supportsNowPlayingMetadata` is `false`, the launcher UI simply doesn't render a "Continue Watching" card for that source. No error, no stub, no fake data.
- For v1, `NetflixSource` can legitimately return `supportsNowPlayingMetadata: false` and skip this entirely — shipping Netflix playback + control without the continue-watching shelf is a complete, honest v1. Whether to attempt DOM scraping for it is a separate, later decision, not a blocker for the POC.
- This directly avoids the trap of building "continue watching for every platform" prematurely, which the stack doc explicitly rules out.

---

## 5. The registry — deliberately not a plugin system

```
// sources/registry.ts
export const SOURCES: Record<string, MediaSource> = {
  netflix: new NetflixSource(),
};
```

That's it. A plain object literal, one entry. When a second source is added, it's one more line. This is intentionally **not**:
- A dynamic plugin loader scanning a directory
- A config file describing sources declaratively
- A DI container

Any of those would be solving a problem v1 doesn't have (exactly one source, known at build time). The registry becomes worth revisiting once there are 3+ sources and the pattern of adding one is well understood from real experience — not before.

---

## 6. Folder structure (pnpm workspace)

```
coosy/
├── packages/
│   ├── shared/                      # types shared by desktop + remote, zero runtime deps
│   │   ├── src/
│   │   │   ├── commands.ts          # RemoteCommand, CommandResult types
│   │   │   ├── media-source.ts      # MediaSource interface, SourceCapabilities
│   │   │   └── ws-protocol.ts       # WebSocket message envelope types
│   │   └── package.json
│   │
│   ├── desktop/                     # Electron app
│   │   ├── src/
│   │   │   ├── main/                # Electron main process
│   │   │   │   ├── index.ts               # app entry, window creation
│   │   │   │   ├── ws-server.ts           # WebSocket server — SOURCE-AGNOSTIC
│   │   │   │   ├── source-host.ts         # WebContentsView lifecycle — SOURCE-AGNOSTIC
│   │   │   │   ├── discovery.ts           # mDNS/Bonjour advertisement
│   │   │   │   ├── db/
│   │   │   │   │   ├── schema.ts          # SQLite schema (better-sqlite3)
│   │   │   │   │   └── db.ts
│   │   │   │   └── sources/               # <-- the ONLY place per-source code lives
│   │   │   │       ├── registry.ts        # the lookup table from §5
│   │   │   │       └── netflix/
│   │   │   │           ├── netflix-source.ts    # implements MediaSource
│   │   │   │           └── netflix-commands.ts  # key-event translation details
│   │   │   │
│   │   │   ├── preload/
│   │   │   │   └── index.ts         # contextBridge, IPC surface for renderer
│   │   │   │
│   │   │   └── renderer/            # React launcher UI (the "TV" screen)
│   │   │       ├── App.tsx
│   │   │       ├── screens/
│   │   │       │   ├── HomeScreen.tsx
│   │   │       │   ├── LoadingScreen.tsx
│   │   │       │   └── PlayerOverlay.tsx
│   │   │       └── components/
│   │   │           ├── SourceTile.tsx       # renders from MediaSource metadata only
│   │   │           └── ContinueCard.tsx     # only renders if capability present
│   │   │
│   │   ├── electron-builder.yml
│   │   └── package.json
│   │
│   └── remote/                      # Phone PWA (React, served by desktop's local server)
│       ├── src/
│       │   ├── App.tsx
│       │   ├── screens/
│       │   │   ├── DPadScreen.tsx
│       │   │   └── TransportScreen.tsx      # buttons enabled per capabilities
│       │   └── ws-client.ts                 # sends RemoteCommand, source-agnostic
│       └── package.json
│
├── pnpm-workspace.yaml
└── package.json
```

**Rule of thumb encoded in this structure:** if a new contributor needs to touch anything outside `packages/desktop/src/main/sources/` to add a new streaming service, the architecture has failed at its one job. Everything else — `ws-server.ts`, `source-host.ts`, the React components, the SQLite schema — should be provably untouched by that change.

---

## 7. What `source-host.ts` and `ws-server.ts` actually own

To make §6's rule concrete, here's what infra owns vs. what it explicitly does not:

**`source-host.ts`** owns:
- Creating/destroying `WebContentsView` instances
- Applying `sessionPartition` for cookie/session isolation
- Showing/hiding views on source switch (kept alive in background per PRD §6.1 — app switching without losing playback position)

It does **not** know what a "seek" means for any given source — it only exposes `getActiveView(): WebContentsView` so a `MediaSource` implementation can act on it.

**`ws-server.ts`** owns:
- Accepting phone WebSocket connections
- Parsing `RemoteCommand` messages
- Looking up the active source id and dispatching to `SOURCES[activeId].handleCommand(...)`
- Broadcasting `CommandResult` back for toast rendering

It does **not** contain any `if (source === 'netflix')` branching anywhere. If that branch ever needs to be written, it belongs inside `netflix-source.ts`, not here.

---

## 8. SQLite schema (v1, minimal)

```
sources (
  id TEXT PRIMARY KEY,          -- 'netflix'
  last_used_at INTEGER
)

app_state (
  key TEXT PRIMARY KEY,
  value TEXT                    -- JSON blob, e.g. last active source
)
```

No per-source tables in v1. Netflix's session data lives in Electron's own `session.partition` storage (cookies/localStorage), not in this schema — CoOSy never touches Netflix credentials, per the stack doc's auth section. This schema only tracks CoOSy's own app-level state (which source was last open, for resume-on-launch).

---

## 9. What this buys later, concretely

When YouTube is added post-POC, the change set is:
1. New file: `sources/youtube/youtube-source.ts` implementing `MediaSource`
2. One new line in `sources/registry.ts`
3. Possibly: a new `SourceCapabilities` combination if YouTube supports something Netflix doesn't (e.g. `supportsNowPlayingMetadata: true` if scraping proves reliable enough there)

No changes to: WebSocket protocol, React remote UI structure, SQLite schema, `source-host.ts`, window management, mDNS discovery. That's the concrete, testable definition of "adding new integrations without affecting prior infra" — not an aspiration, a checklist you can verify against when the second source actually gets built.

---

## 10. Explicitly out of scope for this doc (per YAGNI boundary)

- Local-files-as-a-source design (different enough — direct `<video>` control vs. DOM/keyboard — that it may reveal the interface needs a second method someday; don't guess at that shape now)
- Any kind of source auto-discovery or capability negotiation
- Versioning the `MediaSource` interface itself
- Multi-source-active-at-once (e.g. picture-in-picture) — v1 is one active source at a time, full stop
