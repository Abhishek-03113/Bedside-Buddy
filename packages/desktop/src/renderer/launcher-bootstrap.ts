import type { ConnectionInfo, SourceListItem } from "./coosy-api";

interface LauncherBootstrap {
  sources: SourceListItem[];
  connection: ConnectionInfo | null;
}

let cache: LauncherBootstrap | null = null;

/** Synchronous read of session-cached launcher data (may be null before first load). */
export function getCachedLauncherBootstrap(): LauncherBootstrap | null {
  return cache;
}

/**
 * Load source list + connection info once per session.
 * Returning Home remounts HomeScreen; cache avoids repeated IPC on the hot path.
 */
export async function loadLauncherBootstrap(): Promise<
  LauncherBootstrap & { fromCache: boolean }
> {
  if (cache) {
    return { ...cache, fromCache: true };
  }

  const [sources, connection] = await Promise.all([
    window.coosy?.listSources() ?? Promise.resolve([]),
    window.coosy?.getConnectionInfo() ?? Promise.resolve(null),
  ]);

  cache = { sources, connection };
  return { ...cache, fromCache: false };
}

/** Test seam — clear between tests. */
export function clearLauncherBootstrapCache(): void {
  cache = null;
}
