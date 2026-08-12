# Widevine VMP / EVS Integration — CoOSy

## What is Castlabs ECS?

**Electron for Content Security (ECS)** is a Castlabs-maintained fork of Electron
with DRM support patched in. CoOSy uses it instead of stock Electron because:

- Stock Electron does not ship a usable Widevine CDM path for DRM-protected
  streaming services.
- ECS includes the Component Updater (`wvcus`) that downloads and manages the
  Widevine CDM at runtime.
- ECS ships with development-level VMP signatures that allow DRM playback in
  development environments.

CoOSy pins to:

```
https://github.com/castlabs/electron-releases#v42.8.0+wvcus
```

The `+wvcus` suffix indicates the Component Updater architecture (not the older
`+wvvmp` architecture). **Do not replace this with stock Electron.**

---

## What is `wvcus`?

`wvcus` = Widevine Component Updater Service.

At application startup, ECS downloads and installs the Widevine CDM via Chromium's
Component Updater mechanism. The CDM is installed into the application's user-data
directory — not bundled with the application itself.

This means:

- The installer does NOT bundle a Widevine CDM binary.
- Do NOT manually copy Widevine from Chrome — this is unsupported and will break.
- The `components.whenReady()` API gates execution until the CDM is ready.

---

## What is `components.whenReady()`?

The Castlabs ECS API adds a `components` export to the `electron` module.

```ts
import { components } from "electron";
await components.whenReady();
```

This:

1. Triggers the Component Updater to check for/install the Widevine CDM.
2. Resolves when the CDM is installed and ready.
3. Must be called **before** creating any `BrowserWindow` or `WebContentsView`
   that will attempt DRM playback.

After `whenReady()` resolves, call `components.status()` to inspect the installed
component state. The status object looks like:

```json
{
  "oimompecagnajdejgnnjijobebaeigek": {
    "status": "ready",
    "title": "Widevine Content Decryption Module",
    "version": "4.10.3050.0"
  }
}
```

The component ID (`oimompecagnajdejgnnjijobebaeigek`) is Widevine's Chrome extension
identifier. The status field values include `"new"`, `"ready"`, `"updated"`, and
`"down"`.

CoOSy logs this at startup:

```
[widevine] waiting for Widevine component updater…
[widevine] components ready
[widevine] component status: { … }
```

---

## What is VMP?

**Verified Media Path (VMP)** is a Widevine security concept.

Widevine license servers can verify the integrity of the client runtime before
issuing a license. A VMP-signed Electron binary carries a cryptographic signature
that allows Widevine to confirm the binary has not been tampered with and that it
is an authorized client.

The VMP signature is applied to the Electron binary itself (and supporting
libraries) — not to application source code or the installer.

### Development VMP

ECS distributes its prebuilt binaries with a **development VMP signature**. This
allows DRM playback in development/testing environments and with services that
accept development-signed clients.

Castlabs explicitly states that production applications requiring full production
DRM entitlements must obtain a **production VMP signature** via EVS.

### Production VMP

Production VMP signing is performed by the Castlabs **EVS** service.

The production workflow:

```
electron-builder packs application
        ↓
afterPack hook runs (scripts/vmp-sign.mjs)
        ↓
castlabs_evs.vmp sign-pkg <appOutDir>
        ↓
Electron runtime in appOutDir carries production VMP signature
        ↓
NSIS installer assembled around the signed runtime
        ↓
Distribution
```

---

## What is EVS?

**EVS** is Castlabs' signing service for production VMP signatures.

To use EVS you need:

1. A Castlabs developer account.
2. The `castlabs-evs` Python package installed.
3. Local EVS authentication (credentials stored locally by the EVS CLI —
   **never** in the repository).

---

## Setting Up EVS for Development

### Step 1 — Install Python

macOS / Linux:
```sh
# Check if Python 3 is available:
python3 --version

# If not, install via Homebrew (macOS):
brew install python3
```

Windows:
```cmd
py --version
:: or
python --version
```

### Step 2 — Install the castlabs-evs package

```sh
pip install --upgrade castlabs-evs
# or:
python3 -m pip install --upgrade castlabs-evs
```

### Step 3 — Inspect available commands

Before running any EVS command, check what the installed version provides:

```sh
python3 -m castlabs_evs --help
python3 -m castlabs_evs.account --help
python3 -m castlabs_evs.vmp --help
```

### Step 4 — Create an EVS account or sign in

```sh
# Create a new account (if you don't have one):
python3 -m castlabs_evs.account signup

# Sign in to an existing account:
python3 -m castlabs_evs.account signin
```

EVS credentials are stored in your local EVS configuration directory.
**Never** commit them. They are not in the repository.

### Step 5 — Sign the local Electron runtime (development)

```sh
# From packages/desktop/:
pnpm drm:sign:electron
```

Or directly:

```sh
node packages/desktop/scripts/sign-electron-vmp.mjs
```

This signs the ECS Electron binaries in `node_modules/electron/dist/`.

**Important**: Re-run after every `pnpm install` that updates the `electron` package.

---

## Development Workflow

```sh
# First time / after updating electron:
pnpm --filter @coosy/desktop drm:sign:electron

# Normal development iteration:
pnpm dev
```

Normal `pnpm dev` does NOT call EVS. Signing is an explicit developer step.

---

## Production Build Workflow (Windows x64)

```sh
# 1. Build the application assets
pnpm --filter @coosy/desktop build

# 2. Package — electron-builder calls vmp-sign.mjs via afterPack
pnpm --filter @coosy/desktop package:win
```

### Production VMP required

If EVS signing is required for production, set:

```sh
export COOSY_REQUIRE_VMP_SIGNING=1
pnpm --filter @coosy/desktop package:win
```

Without `COOSY_REQUIRE_VMP_SIGNING=1`, the afterPack hook will warn if EVS is
unavailable but will NOT fail the build. This allows unsigned development builds.
With the flag set, missing EVS credentials fail the build immediately.

### CI environments

Store EVS credentials using your CI system's secret storage. The EVS CLI reads
from its local configuration file — consult Castlabs documentation for CI
authentication options. **Never** store EVS tokens in the repository.

---

## Windows Packaging and VMP Signing Interaction

There are three distinct signing concepts. They are NOT the same thing:

| Concept | What it signs | Purpose |
|---|---|---|
| **Castlabs EVS VMP** | Electron runtime directory | Widevine DRM client trust |
| **Windows Authenticode** | .exe and .dll files | Windows SmartScreen / OS trust |
| **NSIS installer signing** | installer .exe | End-user download trust |

EVS VMP signing is applied to the **unpacked application directory** before the
NSIS installer is assembled (`afterPack` hook). The NSIS installer itself is a
separate signing step using a Windows Authenticode certificate — EVS VMP does not
provide this.

CoOSy's `scripts/vmp-sign.mjs` handles EVS VMP only.

To enable Windows Authenticode signing, set `CSC_LINK` and `CSC_KEY_PASSWORD`
environment variables with a valid Windows code-signing certificate. See
electron-builder documentation for details. Without a certificate, the installer
is **unsigned** — acceptable for local testing.

---

## Diagnosing Failures

### VMP signing script fails

1. Verify Python: `python3 --version`
2. Verify EVS package: `python3 -c "import castlabs_evs; print('ok')"`
3. Sign in: `python3 -m castlabs_evs.account signin`
4. Re-run the signing script.

### `[widevine] Castlabs ECS components API is unavailable` at startup

CoOSy is running against stock Electron. Ensure the `electron` dependency in
`packages/desktop/package.json` is the Castlabs ECS URL:

```
"electron": "https://github.com/castlabs/electron-releases#v42.8.0+wvcus"
```

---

## E100 Diagnostic Decision Tree

Netflix error E100 can have multiple causes. Do not assume VMP is the only
factor. Work through this tree:

```
E100 on Netflix
     │
     ├─ 1. Check ECS runtime
     │      Is [drm] runtime info logged at startup?
     │      Does chrome version match an ECS v42 build?
     │
     ├─ 2. Check components.whenReady()
     │      Does [widevine] components ready appear in logs?
     │      If not: ensureWidevineReady() threw — check startup error.
     │
     ├─ 3. Check Widevine component status
     │      Is [widevine] component status logged?
     │      Is status "ready" (not "down" or missing)?
     │
     ├─ 4. Check VMP signing state
     │      Development ECS binary: carries development VMP.
     │      Some production license servers may refuse dev VMP.
     │      If so: authenticate EVS and run pnpm drm:sign:electron.
     │
     ├─ 5. Clear persistent Netflix session
     │      The session is stored at: userData/Partitions/persist_netflix/
     │      To reset: close CoOSy, delete that directory, relaunch.
     │      If E100 disappears after reset: stale device state was the cause.
     │
     ├─ 6. Compare user agent
     │      [netflix] user agent: logged at startup.
     │      If Netflix rejects an Electron UA: may need to adjust.
     │      Do NOT spoof before confirming the UA is actually the issue.
     │
     ├─ 7. Check network / license error details
     │      Use DevTools on the Netflix WebContentsView.
     │      Do NOT log license request payloads or authorization headers.
     │      Look for HTTP status codes in the license request.
     │
     ├─ 8. Retry playback
     │      CDM component update can complete slightly after app start.
     │      Wait a few seconds and retry.
     │
     └─ 9. Only then consider ECS version change
            Check castlabs/electron-releases for newer +wvcus releases.
            Do NOT downgrade or change major version without understanding
            the root cause.
```

**E100 is not itself proof that VMP is the cause.**
VMP is one critical prerequisite but stale sessions, network issues, region
restrictions, and CDM version mismatches can all produce E100.

---

## What EVS Signing is NOT

- It does NOT bypass DRM.
- It does NOT disable Widevine integrity checks.
- It does NOT extract or copy CDM binaries.
- It does NOT make the Windows installer trusted by Windows SmartScreen.
- It does NOT allow playing DRM content without a valid Netflix subscription.
- It does NOT grant access to Netflix production license servers without
  Castlabs' authorization.

EVS VMP signing is the legitimate Castlabs-supported mechanism for production
DRM client identity.
