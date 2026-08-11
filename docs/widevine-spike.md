# Widevine / DRM spike — go/no-go

**Status:** GO (provisionally) — POC proceeds on castlabs ECS  
**Date:** 2026-08-11  
**OS target for POC:** macOS first (Windows supported by ECS; Linux partial)

## Decision

Use **castlabs Electron for Content Security (ECS)** as a drop-in Electron replacement, tagged `wvcus` (Component Updater installs Widevine CDM).

Pin in `packages/desktop/package.json`:

```text
https://github.com/castlabs/electron-releases#v42.8.0+wvcus
```

Stock Electron does **not** ship a usable Widevine path for Netflix HD. That alone is a no-go for the product premise; ECS is the established mitigation called out in the PRD.

## How we use it

1. Install ECS instead of `electron` from npm.
2. Before creating any window / `WebContentsView`, await `components.whenReady()`.
3. Log `components.status()` once for diagnostics.
4. Do **not** pass `--widevine-cdm-path` (incompatible with `wvcus`).

## Manual validation checklist (run on a real machine)

After `pnpm install` + `pnpm --filter @coosy/desktop dev`:

- [ ] App starts; console shows `[widevine] components ready: …`
- [ ] Open Netflix source → login UI loads
- [ ] Start any title; video plays (not black / error screen)
- [ ] Prefer checking a known DRM title; SD may work where HD needs production VMP

### Expected caveats

| Topic | Note |
|---|---|
| Dev VMP signing | ECS builds are VMP-signed for **development**. Some production license servers may refuse or down-res. Production apps need castlabs **EVS** signing. |
| First launch | CDM download can take a few seconds; `components.whenReady()` gates window open. |
| Packaging | Do not re-download stock Electron during `electron-builder`; package the ECS binary. Avoid breaking VMP signatures (fuses / re-sign order). |
| Linux | ECS Widevine support is partial (no persistent licenses). |

## Go / no-go criteria

| Result | Action |
|---|---|
| Netflix plays under ECS + `components.whenReady()` | **GO** — continue POC on this pin |
| CDM installs but Netflix refuses playback even after login | Re-check VMP / EVS; try another ECS minor; only then reconsider architecture |
| ECS cannot run on target OS at all | **NO-GO** for Electron shell — revisit PRD alternatives (real Chrome kiosk, etc.) |

## POC stance

We treat the spike as **GO to implement** with ECS wired in-app. Final “Netflix HD plays on this laptop” remains a **manual checklist item** under POC acceptance — it cannot be fully automated in CI without credentials and DRM content.

### Smoke result (2026-08-11, macOS arm64)

```
[widevine] components ready: {
  oimompecagnajdejgnnjijobebaeigek: {
    status: 'new',
    title: 'Widevine Content Decryption Module',
    version: '4.10.3050.0'
  }
}
[ws] listening on :17832
[discovery] advertising CoOSy._coosy._tcp on :17832
```

CDM installs and the app boots on ECS. Playback of a Netflix title still needs manual confirmation.

### Dev tip

If Electron starts but `require("electron").app` is undefined, clear `ELECTRON_RUN_AS_NODE` (some IDE sandboxes set it). Desktop scripts already do: `ELECTRON_RUN_AS_NODE= electron-vite …`.
