# CoOSy

Big Picture-style launcher for web media, controlled from your phone.

See [`docs/PRD.md`](docs/PRD.md), [`docs/architecture.md`](docs/architecture.md), [`docs/notes.md`](docs/notes.md), and [`docs/widevine-spike.md`](docs/widevine-spike.md). Progress: [`tasks-desktop-poc.md`](tasks-desktop-poc.md) (also [`tasks.md`](tasks.md)).

## Scope (this repo)

**Only** `packages/shared` and `packages/desktop` are in active scope. The phone remote (`packages/remote`) is out of scope here — see [`docs/notes.md`](docs/notes.md).

## Workspace

```
packages/
  shared/   # RemoteCommand, MediaSource, WS protocol (zero runtime deps) — IN SCOPE
  desktop/  # Electron shell + WS/mDNS + SQLite + TV UI — IN SCOPE
  remote/   # Phone PWA remote — OUT OF SCOPE in this repo
```

**Architecture rule:** adding a streaming source only touches `packages/desktop/src/main/sources/`.

## Requirements

- Node.js ≥ 20
- [pnpm](https://pnpm.io/) 9 (`corepack enable && corepack prepare pnpm@9.15.0 --activate`)

## Setup

```bash
pnpm install
pnpm --filter @coosy/shared build
```

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Run Electron desktop app (dev) |
| `pnpm typecheck` | Typecheck workspace packages |
| `pnpm build` | Build workspace packages |

> Prefer filtering to in-scope packages: `pnpm --filter @coosy/shared --filter @coosy/desktop …`

## v1 bar

From bed, phone-only: open home → launch Netflix → play / pause / seek ±10s → return home.
