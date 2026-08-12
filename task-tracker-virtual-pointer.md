# Virtual Pointer — Self-evaluation Task Tracker

This document records the evaluation loop for the stabilization work: what needed to change, what I changed, and remaining work.

- [1] Fix cursor rendering performance
  - Needed: Stop calling executeJavaScript per pointer update; use a persistent IPC channel and renderer-side rAF coalescing so only the latest state is rendered each frame.
  - Changed: `packages/desktop/src/main/remote-cursor.ts` already used `webContents.send('coosy:remote-cursor', ...)` and rAF in the embedded HTML. Confirmed and left IPC-based update path intact. No per-update executeJavaScript remains.
  - Status: completed.

- [2] Fix cursor overlay lifecycle
  - Needed: Ensure overlay tracks parent window `move`, `resize`, `maximize`, `unmaximize`, `enter-full-screen`, `leave-full-screen`, `minimize`, `restore`, `closed` and hide when app loses focus or is minimized; destroy when main window closed.
  - Changed: Added handling for `blur`, `hide`, `focus`, and `show` events and ensure reposition/show/hide logic in `RemoteCursorOverlay` (`packages/desktop/src/main/remote-cursor.ts`). Also added removal of listeners on dispose.
  - Status: completed.

- [3] Fix stale WebContents target
  - Needed: Do not send input to destroyed/missing WebContents; when an active source has a missing view, the pointer target should be `null` (no fallback).
  - Changed: Verified `getPointerTarget()` already returns `null` when active source's view is missing. Added additional `syncPointerTarget()` calls after view recreation/reattachment so the controller never holds a stale reference (see `packages/desktop/src/main/source-host.ts`).
  - Status: completed.

- [4] Remove active-source → launcher fallback
  - Needed: Ensure the code does NOT silently target launcher when a previously active source's view is destroyed; instead the pointer should be disabled (null target).
  - Changed: `getPointerTarget()` already implements this behavior; no silent fallback to launcher exists. Verified and preserved the correct behaviour.
  - Status: completed.

- [5] Centralize pointer target synchronization
  - Needed: Single `syncPointerTarget()` to be the only place that updates `pointerController.setTarget(...)` and ensure it's called after relevant lifecycle transitions.
  - Changed: `syncPointerTarget()` already exists in `SourceHost`. Added explicit calls to it after view recreation and after reattachment to guarantee timely updates.
  - Status: completed.

- [6] Fix pointer focus session
  - Needed: First pointer movement should focus the target once; subsequent pointer moves must not repeatedly call `focus()`.
  - Changed: The focus model lives in `packages/desktop/src/main/source-input.ts` and `virtual-pointer.ts`. Implementation already follows the model: `focusForInput()` sets `cursor.focused` and `VirtualPointerController.handleInput()` calls `focusForInput()` only on first pointer-move. Verified behavior and preserved it.
  - Status: completed.

- [7] Make trackpad the default remote mode
  - Needed: The remote should open with Trackpad selected by default.
  - Changed: `packages/remote/src/screens/RemoteControls.tsx` default `inputMode` changed to `"trackpad"`.
  - Status: completed.

- [8] Fix Search capability handling
  - Needed: Disable the Search control when the backend reports `canSearch === false` and ensure modal cannot open.
  - Changed: Updated the Search button's `disabled` prop to include `!canSearch` and added a click guard in `RemoteControls.tsx`. The button is only rendered when `canSearch` is true, and now it is double-guarded.
  - Status: completed.

- [9] Remove redundant Scroll buttons
  - Needed: Remove Scroll ↑ / ↓ since two-finger trackpad scroll provides native mouseWheel events.
  - Changed: The primary remote UI already had the scroll buttons removed; confirmed and left the comment noting removal in `RemoteControls.tsx`.
  - Status: completed.

- [10] Audit remaining remote controls
  - Needed: Verify each visible control has a handler and maps to an implemented backend command; remove dead UI.
  - Changed: Performed an initial audit of `RemoteControls.tsx`. Kept playback controls and D-pad. Ensured Search visibility/disabled state and removed scroll buttons. A deeper audit across all actions/handlers may be needed to fully mark this done.
  - Status: in-progress.

- [11] Clean obsolete pointer/input code
  - Needed: Remove duplicate pointer state if it exists and ensure `VirtualPointerController` is the single source of truth. Remove dead handlers and imports introduced by old architectures.
  - Changed: Verified that `VirtualPointerController` owns a `VirtualPointerState` and that `source-input.ts` projects commands onto WebContents using the passed-in cursor. A non-actionable duplicate `PointerCursorState` exists as a helper type; full consolidation (removing the helper from `source-input.ts`) would be a safe follow-up but was not performed to avoid risky refactors in this pass.
  - Status: in-progress.

- [12] Typecheck
  - Needed: Run TypeScript typecheck for the monorepo.
  - Changed: Ran `pnpm -w run typecheck`. All projects reported no type errors.
  - Status: completed.

- [13] Build
  - Needed: Build all workspace projects.
  - Changed: Ran `pnpm -w run build`. Build completed successfully.
  - Status: completed.

- [14] Manual validation
  - Needed: Run the application and perform the manual tests listed in the PRD (launcher pointer, media pointer, horizontal/vertical scroll, source switch, D-pad fallback, search disabled, UI button audit, window lifecycle, pointer performance).
  - Changed: Manual validation remains to be run by you in your environment. I prepared the code so these scenarios should now behave as specified.
  - Status: not-started.

---

Next recommended steps:
- Manual validation as per the provided test matrix (run on the dev machine).
- Complete the deeper audit of `RemoteControls.tsx` and resolve any handler->backend mismatches discovered.
- If you want, I can proceed to consolidate minor duplicate pointer state types into a single source-of-truth in a safe, minimal change set.

Files changed in this pass:
- packages/desktop/src/main/remote-cursor.ts (overlay lifecycle improvements)
- packages/desktop/src/main/source-host.ts (pointer target sync after view recreate/reattach)
- packages/remote/src/screens/RemoteControls.tsx (default to trackpad; search button guard)
- todos-virtual-pointer-stabilization.md (task file)
- task-tracker-virtual-pointer.md (this file)

If you want me to continue, I can: finish the remote controls audit, consolidate pointer state, or run any additional focused checks you request.
