# PRD — CoOSy (working name)
### A "Big Picture" launcher for web-based media, controlled from your phone

---

## 1. Problem statement

You use your laptop, not a TV, as your primary entertainment device. When you're watching from bed, every small action — next episode, seek, pause, switch from Netflix to YouTube — requires physically getting up to reach the laptop. There's no couch-mode / 10-foot UI for the actual apps people use (Netflix, Prime, Hotstar, YouTube, Spotify) the way Steam Big Picture exists for games or Kodi exists for local media libraries.

**Core insight:** the problem isn't "I need a better video player." It's "I need distance between my body and my input device, and none of these web apps were built for that."

---

## 2. Goals

| Goal | Non-goal |
|---|---|
| Full-screen, distraction-free launcher for streaming web apps | Building a replacement video player / codec stack |
| Remote control of playback without walking to the laptop | DRM circumvention or ad-blocking (legal/ToS risk — explicitly out of scope) |
| Unified visual home for all your sources | Multi-user profile management (v1 is single-user, yours) |
| Low-friction phone remote (no app install) | Native mobile app (v1 is a responsive web page) |
| Works today on your existing laptop | A dedicated always-on media box (explicitly deferred, not v1) |

---

## 3. Users

Just you, v1. Designed for one bachelor engineer with one laptop, one bed, one phone. Explicitly **not** designing for multi-room, multi-user, or shared-household scenarios yet — adding that later is a re-scope, not a v1.1.

---

## 4. Core user flows

### Flow A — Casual browse & launch (primary)
1. Laptop is docked/positioned facing the bed, CoOSy launches full-screen (auto-start on boot or via a hotkey).
2. Home screen shows: **Continue Watching** shelf (cross-app, if obtainable — see §7 risk) + **Sources** grid (app icons).
3. User picks up phone, opens `coosy.local` (already bookmarked/PWA-installed) — no login, same LAN.
4. Phone shows a D-pad. User navigates tiles, presses select.
5. Laptop loads the target site inside an embedded Chromium view, full-screen, chromeless (no browser URL bar, no tabs).
6. User does the **first click/login manually via phone as a trackpad** if needed (first-time only, session persists after).

### Flow B — In-bed playback control (the actual pain point)
1. Show is already playing (e.g., Netflix).
2. Phone auto-detects "player context" and swaps its UI to transport controls: play/pause, ±10s, volume, next episode, back to home.
3. Pressing a phone button sends a command over the LAN to the Electron app, which simulates the equivalent keyboard input (spacebar, arrow keys) or DOM event into the active webview.
4. TV screen briefly shows a toast confirming the remote command landed (closes the feedback loop — you're not guessing if it worked).

### Flow C — Source switch mid-session
1. From the player, phone's "home" button returns to the launcher grid (does *not* close the underlying tab — kept alive/suspended for fast resume, budget permitting).
2. User picks a different source; previous one is paused automatically before switch.

### Flow D — First-time pairing
1. Electron app displays a pairing code / QR on launch.
2. Phone scans or types code once; from then on auto-reconnects on same LAN (mDNS/Bonjour discovery so no typing IP addresses).

---

## 5. Features

### v1 (MVP — solves the actual bed problem)
- Full-screen chromeless Electron shell with embedded Chromium webviews (Electron's `<webview>` / `BrowserView`)
- Home screen: static, user-editable list of source tiles (Netflix, Prime, Hotstar, YouTube, Spotify, local files folder)
- Phone remote as a responsive web app (works from any phone browser, installable as PWA, zero native install)
- D-pad style navigation model on TV (arrow-key equivalent focus system) — **this is the actual UI paradigm**, everything is keyboard-navigable because that's what a remote can transmit
- Playback control via simulated key events: spacebar (play/pause), left/right arrows (seek), works on any site using standard HTML5 video controls or YouTube/Netflix's own keybinds
- LAN-based pairing (mDNS discovery, no typing IPs)
- Session persistence per source (stay logged in, Electron partition per site)
- Toast/feedback loop so phone commands show visible confirmation on TV

### v1.5 (fast follow)
- "Continue Watching" shelf — **note:** this requires per-site scraping/heuristics since none of these platforms expose a public "resume" API; treat as best-effort, not guaranteed (see §7)
- Volume control via system-level audio API (not just simulated media keys)
- Quick actions from phone lock screen (media session API / notification controls)
- Multiple named "profiles" of source lists (e.g., "Solo night" vs "Movie night" with different apps pinned)

### v2+ (explicitly deferred, don't scope now)
- Dedicated always-on mini-PC build
- Local media library (Kodi/Plex-style) integration — genuinely a different product, don't conflate
- Voice control
- Multi-device/multi-room sync
- Smart TV casting fallback (Chromecast target)

---

## 6. Features you likely under-articulated (this is the "what did I miss" section)

1. **App switching without losing playback position.** If you go home to browse and come back, does Netflix reload from scratch or resume? Electron `BrowserView` instances can be kept alive in the background (paused, not destroyed) — this needs explicit design, or your "big picture" mode becomes more annoying than alt-tabbing.

2. **Screen-off / standby behavior.** What happens after 20 minutes of no input? Does the laptop screen dim, does audio keep playing (podcast/music use case), does the phone remote show a "still connected" state so you're not stuck.

3. **Volume as a first-class control.** You mentioned seek/pause/next but not volume — likely your #1 most-used control at night (turning down before sleep). Simulated key events for volume are less reliable across sites than system-level `nircmd`/OS audio API — worth doing properly, not as an afterthought.

4. **Text input problem.** Login screens, search bars (YouTube search, Netflix search) need a keyboard. Your phone remote needs a "trackpad + keyboard" fallback mode for these moments, distinct from the D-pad mode. This is probably the single trickiest UX problem in the whole product — most Steam Big Picture complaints are about exactly this.

5. **Ad/pre-roll handling on YouTube.** Ads often can't be skipped via simple key simulation (skip button is a mouse-click target, not a keybind). Phone needs a lightweight "tap here" pointer mode for these moments — likely the same trackpad fallback as #4.

6. **Network resilience.** Phone and laptop on same LAN is a hard assumption — what happens on your college/office wifi with client isolation (common on shared/enterprise networks), or if the laptop sleeps and drops off wifi. Needs a visible "reconnecting…" state, not silent failure.

7. **Auto-launch and recovery.** Does the Electron shell start on laptop boot? What happens if it crashes at 1am mid-episode — auto-restart into the same source?

8. **Multiple simultaneous "casters."** If a friend is also on your wifi with the remote page open, can they control your playback? At minimum needs a simple pairing/session concept even for single-user v1, so you don't accidentally build an open-control surface.

9. **Site layout changes breaking key simulation.** Netflix/Prime/Hotstar redesign their players periodically; a keybind-based approach is fairly resilient (spacebar/arrows are stable across redesigns) but DOM-scraping features (Continue Watching, ad-skip) will break silently. Needs a "does this still work" self-check or graceful degradation, not a hard crash.

10. **Where does audio actually play?** Laptop speakers vs external speaker vs headphones — is there a device-switch control needed from the phone too?

---

## 7. Key technical risks (ranked)

| Risk | Why it matters | Mitigation |
|---|---|---|
| **No official control API for Netflix/Prime/Hotstar** | Core premise of the product | Keyboard-event simulation into the webview is the reliable baseline (works because these are the browser-standard media keybinds); DOM scraping for anything beyond that is fragile and site-specific — scope it as "best effort," communicate this to yourself in the UI (e.g. grey out unsupported controls per-site) rather than pretending uniform support |
| **DRM / Widevine in Electron** | Netflix, Prime, Hotstar require Widevine CDM for HD/DRM content | Electron supports Widevine via `castlabs/electron-releases` (a widely-used community fork) or by enabling Chromium's component; **do a spike here before building anything else** — this is a go/no-go gate for the whole project, not a detail |
| **Session/cookie persistence per site** | You don't want to log into Netflix every time | Electron `session.partition` per BrowserView, persisted to disk |
| **Text input UX (search, login)** | See §6.4 | Trackpad + on-screen keyboard fallback mode on phone |
| **LAN discovery reliability** | mDNS can be flaky on some routers/network configs | Fallback: show IP+port as QR code if mDNS fails |
| **ToS considerations** | Automating input into these sites is a grey area but is fundamentally the same as pressing keys on your own keyboard — no scraping of paid content, no ad-blocking, no DRM bypass | Keep strictly to "simulating a human pressing keys/clicking," never touch video streams or licensing — this keeps it defensible as personal-use automation |

**Recommendation: spike the Widevine DRM question in Electron first, this week, before any other work.** If HD playback doesn't work cleanly, the whole architecture needs rethinking (e.g., falling back to a real embedded browser process rather than a custom webview).

---

## 8. Tech stack

### Chosen direction (matches your ask)
- **Shell:** Electron + TypeScript
  - `BrowserView` (not `<webview>` tag — deprecated/discouraged by Electron team) for embedding each source, one partition per site for isolated sessions
  - Global input capture for D-pad-style keyboard navigation on the home screen
  - `robotjs` or Electron's own `sendInputEvent` for simulating key presses into the active BrowserView
- **Remote server:** lightweight local server inside the Electron main process
  - **Option A (recommended): Go binary sidecar** — since you already write Go professionally, a small Go service (using `gorilla/websocket` or plain `net/http`) running as a child process of Electron, exposing a WebSocket for low-latency remote commands + mDNS advertisement (`grandcast`/`zeroconf` libs). Electron main process talks to it over localhost WebSocket/IPC.
  - **Option B: pure TypeScript/Node** — `ws` package for WebSocket server + `bonjour-service` for mDNS, all inside the Electron main process, one less moving part, no cross-language IPC.
  - *My take: Option B first for v1 — one language, less deployment complexity. Revisit Go sidecar only if you specifically want a separable "media brain" that could later run on a headless box independent of Electron.*
- **Remote UI (phone):** plain responsive HTML/CSS/JS or a minimal React/Preact app served by the same local server, installable as a PWA (manifest + service worker for offline shell, though it always needs LAN connectivity to function)
- **DRM:** `castlabs/electron-releases` fork with Widevine CDM enabled (spike this first — see §7)

### Alternative stacks considered (since you said open to Go/TS)

| Stack | Pros | Cons |
|---|---|---|
| **Electron + TS (chosen)** | Full Chromium control, best DRM story, mature ecosystem, matches your stated preference | Heavier resource footprint than alternatives |
| **Tauri (Rust core + TS frontend)** | Much lighter binary, uses system webview | System webview (WebView2 on Windows) has murkier Widevine support than Electron's bundled Chromium — likely a dealbreaker given §7 |
| **Go backend + native OS webview (webview/webview_go) + TS frontend** | Lets you lean into Go more; small footprint | Same DRM uncertainty as Tauri; less community precedent for exactly this use case |
| **Browser extension + existing browser, no Electron at all** | Zero DRM risk (uses your real Chrome/Edge with Widevine already working), much less to build | Can't get a clean chromeless "big picture" shell this way — browser UI (tabs, URL bar) still visible unless you fight the browser's own kiosk mode, which varies by OS and is less controllable than owning the shell |

**Recommendation stands: Electron + TypeScript for the shell, Node/TS (not Go) for the local remote server in v1**, purely to minimize moving parts while you validate the DRM spike. Go sidecar is a legitimate v2 refactor if you want the "media brain" to be independently deployable (e.g., toward the dedicated-box future you flagged as later).

---

## 9. Open questions to resolve before v1 build starts

1. Does Widevine actually work cleanly in Electron for HD Netflix/Prime/Hotstar content on your machine? *(blocking spike)*
2. OS target — Windows, Linux, or both? (Affects mDNS library choice and autostart mechanism.)
3. Do you want the phone remote to require zero setup (just visit an IP) or is a one-time PWA install acceptable?
4. Should "Continue Watching" be scoped into v1 at all, given it's the least reliable feature technically — or deliberately punted to v1.5 so v1 ships faster?

---

## 10. Success criteria for v1

You can, from bed, using only your phone:
- See a home screen of your sources
- Launch Netflix/YouTube/Prime/Hotstar into full-screen playback
- Pause, play, seek ±10s, and return home
- Without ever touching the laptop physically

That's the whole bar for v1. Everything else in this doc is sequencing after that.
