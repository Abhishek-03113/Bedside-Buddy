# Windows Release — CoOSy

This document describes how to build, sign, and install the CoOSy Windows x64
NSIS installer.

---

## Requirements

| Requirement | Version / Notes |
|---|---|
| Node.js | ≥ 20 |
| pnpm | 9.15.0 (pinned) |
| Python | 3.x — for EVS VMP signing |
| castlabs-evs | `pip install --upgrade castlabs-evs` |
| EVS account | Required for production VMP signing |
| Windows code-signing cert | Optional — needed for Authenticode |

---

## Development Build (macOS → Windows cross-build)

CoOSy can be cross-packaged for Windows from macOS using electron-builder.

### Step 1 — Install dependencies

```sh
pnpm install
```

### Step 2 — Authenticate EVS (optional for dev, required for prod)

```sh
python3 -m castlabs_evs.account signin
```

### Step 3 — Sign the local Electron runtime (optional for dev)

This step is needed if you want development VMP signatures on the runtime.
Development ECS builds already carry Castlabs' development-level VMP signature.

```sh
pnpm --filter @coosy/desktop drm:sign:electron
```

### Step 4 — Start the application (development)

```sh
pnpm dev
```

---

## Building the Windows Installer

### Step 1 — Build application assets

Build all packages (renderer, main, preload, remote UI):

```sh
pnpm --filter @coosy/desktop build
```

This runs:
- `pnpm --filter @coosy/remote build` — builds the phone remote UI
- `electron-vite build` — compiles main, preload, renderer
- `node ./scripts/copy-remote-ui.mjs` — copies remote UI into `out/remote/`

### Step 2 — Verify unpacked build (optional but recommended)

Before creating the full NSIS installer, produce an unpacked directory for
quick inspection:

```sh
pnpm --filter @coosy/desktop package:win:dir
```

Output: `packages/desktop/release/win-unpacked/`

Verify:
- `CoOSy.exe` exists
- `resources/app.asar` (or `resources/app/`) exists
- `resources/app/out/preload/index.js` exists
- `resources/app/out/preload/remote-cursor-preload.js` exists

### Step 3 — Build the NSIS installer

```sh
pnpm --filter @coosy/desktop package:win
```

Or from `packages/desktop/`:

```sh
pnpm package:win
```

Output: `packages/desktop/release/CoOSy Setup <version>.exe`

### Step 4 — Production VMP signing

To require production VMP signing (EVS credentials must be present):

```sh
export COOSY_REQUIRE_VMP_SIGNING=1
pnpm --filter @coosy/desktop package:win
```

The `afterPack` hook (`scripts/vmp-sign.mjs`) runs automatically during
`package:win`. When `COOSY_REQUIRE_VMP_SIGNING=1`, signing failure aborts the
build. Without the flag, missing EVS credentials produce a warning and the build
continues with the Castlabs development-signed runtime.

---

## Installing on Windows

1. Copy `CoOSy Setup <version>.exe` to a Windows machine.
2. Double-click the installer.
3. Follow the installation wizard:
   - Choose installation directory (default: `%LOCALAPPDATA%\Programs\CoOSy`)
   - Optionally create a Desktop shortcut
4. Launch CoOSy from the Start Menu or Desktop shortcut.

---

## Verifying Widevine at Runtime

After installing and launching on Windows, check the application logs for:

```
[drm] runtime info: { app: '0.1.0', electron: '...', chrome: '...', ... }
[widevine] waiting for Widevine component updater…
[widevine] components ready
[widevine] component status: { ... "status": "ready" ... }
[netflix] user agent: Mozilla/5.0 ...
```

Access logs:
- Open DevTools: **View → Toggle Developer Tools** (if enabled in the build)
- Or check the Electron log file in `%APPDATA%\CoOSy\logs\`

---

## Netflix Validation

1. Launch CoOSy.
2. Wait for `[widevine] components ready` in logs.
3. Select the Netflix tile.
4. Sign in to Netflix.
5. Play a known DRM title (e.g., a Netflix Original).
6. Observe whether playback succeeds or E100 appears.

If E100 occurs, follow the diagnostic tree in `docs/widevine-vmp.md`.

---

## Clearing a Stale Netflix Session

If Netflix produces E100 and you suspect stale device data:

1. Close CoOSy completely.
2. Open: `%APPDATA%\CoOSy\Partitions\persist_netflix\`
3. Delete the entire `persist_netflix` folder.
4. Relaunch CoOSy.
5. Sign in to Netflix again.
6. Retry playback.

If E100 disappears: stale session/device state was the cause.

---

## Windows Code Signing Status

> **Installer is UNSIGNED** (unless you supply a Windows Authenticode certificate).

An unsigned installer will trigger Windows SmartScreen:

- Users will see "Windows protected your PC" dialog.
- Click "More info" → "Run anyway" to proceed.

This is acceptable for local testing and internal distribution. For public
distribution, obtain an Authenticode code-signing certificate and configure
it via:

```sh
export CSC_LINK=/path/to/certificate.p12
export CSC_KEY_PASSWORD=<password>
pnpm --filter @coosy/desktop package:win
```

electron-builder will sign automatically when these are present.

**Note:** Windows Authenticode signing is completely separate from EVS VMP
signing. Authenticode = Windows OS trust. EVS VMP = Widevine DRM client trust.

---

## E100 Troubleshooting

| Symptom | Check |
|---|---|
| E100 immediately on play | Widevine component status — is it `"ready"`? |
| E100 after sign-in | VMP state — development or production signed? |
| E100 only on first launch | CDM may still be downloading — wait and retry |
| E100 after working previously | Clear the Netflix persistent session |
| E100 on all titles | Check user agent in logs |
| E100 on HD only | Production VMP required for HD tier |

Refer to `docs/widevine-vmp.md` for the full decision tree.

---

## Reproducing a Windows Build from Scratch

```sh
# Clone the repo
git clone <repo-url>
cd Coosy

# Install dependencies
pnpm install

# Authenticate EVS (optional — dev builds work without this)
python3 -m castlabs_evs.account signin

# Build application
pnpm --filter @coosy/desktop build

# Package Windows x64 NSIS installer
pnpm --filter @coosy/desktop package:win

# Output:
# packages/desktop/release/CoOSy Setup 0.1.0.exe
```
