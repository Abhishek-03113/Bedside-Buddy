import { useCallback, useEffect, useState } from "react";
import type { NavAction } from "@coosy/shared";
import { SourceTile } from "../components/SourceTile";
import { ContinueCard } from "../components/ContinueCard";
import type { ConnectionInfo, SourceListItem } from "../coosy-api";

interface HomeScreenProps {
  onSelectSource: (id: string) => void;
}

export function HomeScreen({ onSelectSource }: HomeScreenProps) {
  const [sources, setSources] = useState<SourceListItem[]>([]);
  const [focusIndex, setFocusIndex] = useState(0);
  const [connection, setConnection] = useState<ConnectionInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

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
        setFocusIndex(0);
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Failed to load");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectFocused = useCallback(() => {
    const source = sources[focusIndex];
    if (source) onSelectSource(source.id);
  }, [focusIndex, onSelectSource, sources]);

  const applyNav = useCallback(
    (action: NavAction) => {
      if (sources.length === 0) return;
      if (action === "select") {
        selectFocused();
        return;
      }
      if (action === "home" || action === "back") return;

      setFocusIndex((current) => {
        const cols = Math.max(
          1,
          Math.floor(
            (typeof window !== "undefined" ? window.innerWidth * 0.9 : 800) /
              180,
          ),
        );
        switch (action) {
          case "left":
            return (current - 1 + sources.length) % sources.length;
          case "right":
            return (current + 1) % sources.length;
          case "up":
            return (current - cols + sources.length) % sources.length;
          case "down":
            return (current + cols) % sources.length;
          default:
            return current;
        }
      });
    },
    [selectFocused, sources.length],
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

      <section className="home__sources" aria-label="Sources">
        {sources.map((source, index) => (
          <SourceTile
            key={source.id}
            id={source.id}
            displayName={source.displayName}
            icon={source.icon}
            focused={index === focusIndex}
            index={index}
            onSelect={() => onSelectSource(source.id)}
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
