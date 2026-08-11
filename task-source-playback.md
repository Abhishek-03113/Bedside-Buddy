# Source playback lifecycle

## Status

Implemented and verified on 2026-08-11.

## Changes

- Added `MediaSource.pausePlayback()` and `SourceInput.pauseMedia()`.
- SourceHost pauses before switching sources or returning to the launcher.
- Retained source views are detached, not destroyed, preserving sessions for reuse.
- Netflix, YouTube, Hotstar, and Prime Video use an idempotent DOM media pause.

## Verification

- `pnpm typecheck`
- Desktop test suite: 41 passing
- `pnpm build`

## Follow-up

- Manually confirm active player detection on each live streaming service in Electron.
