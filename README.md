# CoOSy

Big Picture-style launcher for web media, controlled from your phone.

See [`docs/PRD.md`](docs/PRD.md) and [`docs/architecture.md`](docs/architecture.md). Progress lives in [`tasks.md`](tasks.md).

## Workspace

```
packages/
  shared/   # RemoteCommand, MediaSource, WS protocol (zero runtime deps)
  desktop/  # Electron shell + WS/mDNS + SQLite + TV UI
  remote/   # Phone PWA remote
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
| `pnpm dev:remote` | Vite dev server for phone remote |
| `pnpm typecheck` | Typecheck all packages |
| `pnpm build` | Build all packages |

## v1 bar

From bed, phone-only: open home → launch Netflix → play / pause / seek ±10s → return home.
