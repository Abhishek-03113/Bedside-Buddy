import { useCallback, useEffect, useRef, useState } from "react";
import type { NavAction, PlaybackHistoryItem } from "@coosy/shared";
import { SourceTile } from "../components/SourceTile";
import { ContinueCard } from "../components/ContinueCard";
import type { ConnectionInfo, SourceListItem } from "../coosy-api";
import {
  clampFocusIndex,
  columnCountFromTemplate,
  moveFocusIndex,
  resolveInitialFocusIndex,
} from "../launcher-focus";
import { perfInc } from "../../shared/perf";
import {
  getCachedLauncherBootstrap,
  loadLauncherBootstrap,
} from "../launcher-bootstrap";
import { getCachedPlaybackHistory, refreshPlaybackHistory } from "../playback-history";
import { toContinueItems } from "../continue-items";

/** Stable key → nav map — allocated once, not per keydown. */
const KEY_TO_NAV: Record<string, NavAction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  Enter: "select",
  " ": "select",
};

interface HomeScreenProps {
  onSelectSource: (id: string) => void;
  onResumePlaybackHistory: (item: PlaybackHistoryItem) => void;
  /** Restore focus after returning from a media source, when possible. */
  initialFocusSourceId?: string | null;
}

/**
 * Keyboard / remote nav → focus index only.
 * Listeners are registered once (refs hold latest sources/focus/callbacks)
 * so arrow keys do not tear down and re-add window/IPC listeners.
 */
export function HomeScreen({
  onSelectSource,
  onResumePlaybackHistory,
  initialFocusSourceId = null,
}: HomeScreenProps) {
  perfInc("homeScreen.render");

  const cached = getCachedLauncherBootstrap();
  const [sources, setSources] = useState<SourceListItem[]>(
    () => cached?.sources ?? [],
  );
  const [focusIndex, setFocusIndex] = useState(() =>
    resolveInitialFocusIndex(
      (cached?.sources ?? []).map((s) => s.id),
      initialFocusSourceId,
    ),
  );
  const [connection, setConnection] = useState<ConnectionInfo | null>(
    () => cached?.connection ?? null,
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [continueWatching, setContinueWatching] = useState(getCachedPlaybackHistory);
  const gridRef = useRef<HTMLElement | null>(null);
  const columnsRef = useRef(1);
  const focusIndexRef = useRef(focusIndex);
  const sourcesRef = useRef(sources);
  const onSelectSourceRef = useRef(onSelectSource);

  focusIndexRef.current = focusIndex;
  sourcesRef.current = sources;
  onSelectSourceRef.current = onSelectSource;

  // Load once per mount; session cache avoids IPC on Home remount after source.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { sources: list, connection: info, fromCache } =
          await loadLauncherBootstrap();
        if (cancelled) return;
        setSources(list);
        setConnection(info);
        if (!fromCache) {
          perfInc("ipc.invoke", 2);
        }
        setFocusIndex(
          resolveInitialFocusIndex(
            list.map((s) => s.id),
            initialFocusSourceId,
          ),
        );
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Failed to load");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // Mount-only bootstrap — preferred focus is applied from initial state / this load.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only bootstrap
  }, []);

  // Home remains usable while this best-effort source-page request runs.
  useEffect(() => {
    let cancelled = false;
    void refreshPlaybackHistory()
      .then((items) => {
        if (!cancelled) setContinueWatching(items);
      })
      .catch((error) => console.warn("[launcher] playback history unavailable", error));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setFocusIndex((current) => clampFocusIndex(current, sources.length));
  }, [sources.length]);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const measure = () => {
      perfInc("resizeObserver.measure");
      const next = columnCountFromTemplate(
        getComputedStyle(grid).gridTemplateColumns,
      );
      if (next !== columnsRef.current) {
        columnsRef.current = next;
        perfInc("resizeObserver.columnsChanged");
      }
    };
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(grid);
    return () => observer.disconnect();
  }, [sources.length]);

  // Stable nav applicator — never depends on focusIndex/sources identity.
  const applyNav = useCallback((action: NavAction) => {
    const list = sourcesRef.current;
    if (list.length === 0) return;
    if (action === "select") {
      const source = list[focusIndexRef.current];
      if (source) onSelectSourceRef.current(source.id);
      return;
    }
    if (action === "home" || action === "back") return;

    perfInc("focus.nav");
    setFocusIndex((current) => {
      const next = moveFocusIndex(
        current,
        action,
        list.length,
        columnsRef.current,
      );
      return next === current ? current : next;
    });
  }, []);

  const handleSelect = useCallback((id: string) => {
    onSelectSourceRef.current(id);
  }, []);

  const handleResume = useCallback((item: PlaybackHistoryItem) => {
    onResumePlaybackHistory(item);
  }, [onResumePlaybackHistory]);

  const handleFocusRequest = useCallback((index: number) => {
    setFocusIndex((current) => (current === index ? current : index));
  }, []);

  // Register key + remote listeners once; refs keep handlers current.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement | null)?.closest(".continue-card")) {
        return;
      }
      const action = KEY_TO_NAV[event.key];
      if (!action) return;
      // Prevent Space from scrolling the launcher when activating a tile.
      event.preventDefault();
      perfInc("keydown.handler");
      applyNav(action);
    };
    window.addEventListener("keydown", onKeyDown);
    perfInc("listener.register");
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      perfInc("listener.cleanup");
    };
  }, [applyNav]);

  useEffect(() => {
    if (!window.coosy?.onNav) return;
    perfInc("listener.register");
    const unsubscribe = window.coosy.onNav((action) => applyNav(action));
    return () => {
      unsubscribe();
      perfInc("listener.cleanup");
    };
  }, [applyNav]);

  // DOM focus only when index changes; skip if already focused (no layout thrash).
  useEffect(() => {
    const el = document.querySelector<HTMLElement>(
      `[data-source-index="${focusIndex}"]`,
    );
    if (!el || document.activeElement === el) return;
    perfInc("focus.dom");
    el.focus();
  }, [focusIndex]);

  const endpoint =
    connection?.ip != null
      ? `ws://${connection.ip}:${connection.port}`
      : connection
        ? `ws://<this-mac>:${connection.port}`
        : null;

  return (
    <main className="home">
      <header className="home__header">
        <h1 className="home__brand">Co<span>OSy</span></h1>
        <div className="home__status" aria-label="Remote is ready to connect">
          <span className="home__status-dot" />
          {connection ? "Phone ready" : "Connecting phone"}
        </div>
        <span className="home__settings" aria-hidden="true">⚙</span>
      </header>

      <ContinueCard
        items={toContinueItems(continueWatching, sources)}
        onSelect={handleResume}
      />

      {loadError ? <p className="home__error">{loadError}</p> : null}

      <section
        ref={gridRef}
        className="home__sources"
        aria-label="Sources"
      >
        <div className="home__sources-heading">
          <h2>Sources</h2>
          <span>Browse all</span>
        </div>
        {sources.map((source, index) => (
          <SourceTile
            key={source.id}
            id={source.id}
            displayName={source.displayName}
            icon={source.icon}
            focused={index === focusIndex}
            index={index}
            onSelect={handleSelect}
            onFocusRequest={handleFocusRequest}
          />
        ))}
      </section>

      {connection ? (
        <footer className="home__pairing" aria-label="Phone pairing">
          <div>
            <span className="home__pairing-label">Pairing code</span>
            <strong className="home__pairing-code">
              {connection.pairingCode}
            </strong>
          </div>
          <div>
            <span className="home__pairing-label">Connect</span>
            <code className="home__pairing-endpoint">{endpoint}</code>
            <span className="home__pairing-hint">
              mDNS: {connection.mdnsName} · enter code once in remote hello
            </span>
          </div>
        </footer>
      ) : null}
    </main>
  );
}
