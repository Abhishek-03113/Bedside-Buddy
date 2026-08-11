# Playback History

- [x] Inspect and replace the prior Continue Watching scraping path.
- [x] Add the shared playback-history model and SQLite migration-safe table/operations.
- [x] Add source-owned playable URL detection and resume validation for all sources.
- [x] Record playback on active-source navigation and update it when leaving a source.
- [x] Wire asynchronous history data and resume dispatch to the existing ContinueCard.
- [x] Add deterministic tests for storage semantics, URL detection, failure isolation, and resume dispatch.
- [x] Run tests, typecheck, build, and diff checks.
- [x] Add local source-logo assets with a one-time fetch script and use them as history-card fallbacks.
- [ ] Manually validate each authenticated source's content URL detection, history card, switching, resume, and relaunch.
