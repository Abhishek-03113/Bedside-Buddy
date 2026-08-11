import { useCallback, useEffect, useRef, useState } from "react";
import type { NavAction } from "@coosy/shared";
import { SourceTile } from "../components/SourceTile";
import { ContinueCard } from "../components/ContinueCard";
import type { ConnectionInfo, SourceListItem } from "../coosy-api";
import {
  clampFocusIndex,
  columnCountFromTemplate,
  moveFocusIndex,
  resolveInitialFocusIndex,
} from "../launcher-focus";

interface HomeScreenProps {
  onSelectSource: (id: string) => void;
  /** Restore focus after returning from a media source, when possible. */
  initialFocusSourceId?: string | null;
}

export function HomeScreen({
  onSelectSource,
  initialFocusSourceId = null,
}: HomeScreenProps) {
  const [sources, setSources] = useState<SourceListItem[]>([]);
  const [focusIndex, setFocusIndex] = useState(0);
  const [connection, setConnection] = useState<ConnectionInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const gridRef = useRef<HTMLElement | null>(null);
  const columnsRef = useRef(1);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [list, info] = await Promise.all([
          window.coosy?.listSources() ?? Promise.resolve([]),
          window.coosy?.getConnectionInfo() ?? Promise.resolve(null),
        ]);
        if (cancelled) return;
        setSources(list);
        setConnection(info);
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
  }, [initialFocusSourceId]);

  useEffect(() => {
    setFocusIndex((current) => clampFocusIndex(current, sources.length));
  }, [sources.length]);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const measure = () => {
      columnsRef.current = columnCountFromTemplate(
        getComputedStyle(grid).gridTemplateColumns,
      );
    };
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(grid);
    return () => observer.disconnect();
  }, [sources.length]);

  const activateFocusedSource = useCallback(() => {
    const source = sources[focusIndex];
    if (source) onSelectSource(source.id);
  }, [focusIndex, onSelectSource, sources]);

  const applyNav = useCallback(
    (action: NavAction) => {
      if (sources.length === 0) return;
      if (action === "select") {
        activateFocusedSource();
        return;
      }
      if (action === "home" || action === "back") return;

      setFocusIndex((current) =>
        moveFocusIndex(current, action, sources.length, columnsRef.current),
      );
    },
    [activateFocusedSource, sources.length],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const map: Record<string, NavAction> = {
        ArrowUp: "up",
        ArrowDown: "down",
        ArrowLeft: "left",
        ArrowRight: "right",
        Enter: "select",
        " ": "select",
      };
      const action = map[event.key];
      if (!action) return;
      // Prevent Space from scrolling the launcher when activating a tile.
      event.preventDefault();
      applyNav(action);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [applyNav]);

  useEffect(() => {
    if (!window.coosy?.onNav) return;
    return window.coosy.onNav((action) => applyNav(action));
  }, [applyNav]);

  useEffect(() => {
    const el = document.querySelector<HTMLElement>(
      `[data-source-index="${focusIndex}"]`,
    );
    el?.focus();
  }, [focusIndex, sources]);

  const endpoint =
    connection?.ip != null
      ? `ws://${connection.ip}:${connection.port}`
      : connection
        ? `ws://<this-mac>:${connection.port}`
        : null;

  return (
    <main className="home">
      <header className="home__header">
        <h1 className="home__brand">CoOSy</h1>
        <p className="home__tagline">Pick a source. Control from your phone.</p>
      </header>

      <ContinueCard items={[]} />

      {loadError ? <p className="home__error">{loadError}</p> : null}

      <section
        ref={gridRef}
        className="home__sources"
        aria-label="Sources"
      >
        {sources.map((source, index) => (
          <SourceTile
            key={source.id}
            id={source.id}
            displayName={source.displayName}
            icon={source.icon}
            focused={index === focusIndex}
            index={index}
            onSelect={() => onSelectSource(source.id)}
            onFocusRequest={() => setFocusIndex(index)}
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
