import { useEffect, useRef, useState, type FormEvent } from "react";
import type { RemoteCommand, SourceCapabilities } from "@coosy/shared";
import type { ConnectionStatus, WsClient } from "../ws-client";
import { resolveControlAction } from "../remote-actions";
import { TrackpadSurface } from "../components/TrackpadSurface";
import { KeyboardInput } from "../components/KeyboardInput";
import { SpecialKeys } from "../components/SpecialKeys";

interface RemoteControlsProps {
  client: WsClient;
  status: ConnectionStatus;
  mode: "launcher" | "player";
  activeSourceName: string | null;
  capabilities: SourceCapabilities | null;
  toast: { message: string; ok: boolean } | null;
  onToast: (toast: { message: string; ok: boolean }) => void;
}

/**
 * Phone remote chrome — source-agnostic. Never branches on Netflix/YouTube/etc.
 */
export function RemoteControls({
  client,
  status,
  mode,
  activeSourceName,
  capabilities,
  toast,
  onToast,
}: RemoteControlsProps) {
  const [busy, setBusy] = useState(false);
  const [inputMode, setInputMode] = useState<"dpad" | "trackpad">("trackpad");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const padRef = useRef<HTMLDivElement | null>(null);

  const seek = capabilities?.supportsSeek ?? true;
  const volume = capabilities?.supportsVolume ?? true;
  const browse = capabilities?.supportsBrowseNavigate ?? true;
  const canSearch = capabilities?.supportsSearch ?? false;
  const mediaEnabled = mode === "player";

  useEffect(() => {
    if (!searchOpen) return;
    searchInputRef.current?.focus();
  }, [searchOpen]);

  // Keep the control surface from scrolling/zooming under thumbs.
  useEffect(() => {
    const el = padRef.current;
    if (!el) return;
    const block = (event: TouchEvent) => {
      if ((event.target as HTMLElement | null)?.closest("input, textarea")) {
        return;
      }
      event.preventDefault();
    };
    el.addEventListener("touchmove", block, { passive: false });
    return () => el.removeEventListener("touchmove", block);
  }, []);

  const press = async (action: Parameters<typeof resolveControlAction>[1]) => {
    const dispatch = resolveControlAction(mode, action);
    try {
      if (dispatch.kind === "nav") {
        await client.sendNav(dispatch.action);
        onToast({ message: `nav:${dispatch.action}`, ok: true });
        return;
      }
      setBusy(true);
      const result = await client.sendCommand(dispatch.command);
      onToast({
        message: result.ok
          ? dispatch.command.type
          : `${dispatch.command.type} failed (${result.reason})`,
        ok: result.ok,
      });
    } catch {
      onToast({ message: "Not connected", ok: false });
    } finally {
      setBusy(false);
    }
  };

  const pressCommand = async (command: RemoteCommand) => {
    setBusy(true);
    try {
      const result = await client.sendCommand(command);
      onToast({
        message: result.ok
          ? command.type === "search"
            ? `search: ${command.query}`
            : command.type
          : `${command.type} failed (${result.reason})`,
        ok: result.ok,
      });
    } catch {
      onToast({ message: "Connection lost", ok: false });
    } finally {
      setBusy(false);
    }
  };

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;
    setSearchOpen(false);
    setSearchQuery("");
    void pressCommand({ type: "search", query });
  };

  const contextLabel =
    mode === "player" && activeSourceName ? activeSourceName : "Launcher";

  return (
    <main className="remote remote--controls" ref={padRef}>
      <header className="remote__header">
        <div className="remote__brand-block">
          <h1 className="remote__title">CoOSy</h1>
          <p className="remote__source" aria-live="polite">
            {contextLabel}
          </p>
        </div>
        <p
          className={`remote__status remote__status--${status.toLowerCase()}`}
          aria-live="polite"
        >
          {status}
        </p>
      </header>

      <section className="remote__system" aria-label="System">
        <button
          type="button"
          className="remote__chip"
          onClick={() => void press("back")}
        >
          Back
        </button>
        <button
          type="button"
          className="remote__chip remote__chip--accent"
          onClick={() => void press("home")}
        >
          Home
        </button>
        {canSearch ? (
          <button
            type="button"
            className="remote__chip remote__chip--search"
            disabled={busy || !mediaEnabled}
            onClick={() => setSearchOpen(true)}
            title={!mediaEnabled ? "Open a source to search" : "Search"}
          >
            Search
          </button>
        ) : null}
      </section>

      <div className="remote__input-toggle">
        <button
          type="button"
          className={`remote__toggle-btn ${inputMode === "dpad" ? "remote__toggle-btn--active" : ""}`}
          onClick={() => setInputMode("dpad")}
        >
          D-pad
        </button>
        <button
          type="button"
          className={`remote__toggle-btn ${inputMode === "trackpad" ? "remote__toggle-btn--active" : ""}`}
          onClick={() => setInputMode("trackpad")}
        >
          Trackpad
        </button>
      </div>

      {inputMode === "dpad" ? (
        <div className="dpad" role="group" aria-label="D-pad">
          <button
            type="button"
            className="dpad__btn dpad__up"
            disabled={busy || (mediaEnabled && !browse)}
            onClick={() => void press("up")}
          >
            ▲
          </button>
          <button
            type="button"
            className="dpad__btn dpad__left"
            disabled={busy || (mediaEnabled && !browse)}
            onClick={() => void press("left")}
          >
            ◀
          </button>
          <button
            type="button"
            className="dpad__btn dpad__select"
            disabled={busy || (mediaEnabled && !browse)}
            onClick={() => void press("select")}
            aria-label="Select"
          >
            SELECT
          </button>
          <button
            type="button"
            className="dpad__btn dpad__right"
            disabled={busy || (mediaEnabled && !browse)}
            onClick={() => void press("right")}
          >
            ▶
          </button>
          <button
            type="button"
            className="dpad__btn dpad__down"
            disabled={busy || (mediaEnabled && !browse)}
            onClick={() => void press("down")}
          >
            ▼
          </button>
        </div>
      ) : (
        <div style={{ width: "min(100%, 17.5rem)", height: "13rem", margin: "0.15rem 0", display: "flex" }}>
          <TrackpadSurface client={client} status={status} onToast={onToast} />
        </div>
      )}

      {inputMode === "trackpad" ? (
        <div className="remote__keyboard-area">
          <KeyboardInput client={client} status={status} onToast={onToast} />
          <SpecialKeys client={client} onToast={onToast} />
        </div>
      ) : null}


      <div className="transport" aria-label="Playback">
        <button
          type="button"
          disabled={busy || !mediaEnabled}
          onClick={() => void pressCommand({ type: "toggle-play-pause" })}
        >
          Play / Pause
        </button>
        <button
          type="button"
          disabled={busy || !mediaEnabled || !seek}
          onClick={() =>
            void pressCommand({ type: "seek", deltaSeconds: -10 })
          }
        >
          Seek −
        </button>
        <button
          type="button"
          disabled={busy || !mediaEnabled || !seek}
          onClick={() =>
            void pressCommand({ type: "seek", deltaSeconds: 10 })
          }
        >
          Seek +
        </button>
        <button
          type="button"
          disabled={busy || !mediaEnabled || !volume}
          onClick={() =>
            void pressCommand({ type: "volume", direction: "down" })
          }
        >
          Vol −
        </button>
        <button
          type="button"
          disabled={busy || !mediaEnabled || !volume}
          onClick={() =>
            void pressCommand({ type: "volume", direction: "up" })
          }
        >
          Vol +
        </button>
      </div>

      <div
        className={`remote__toast${toast ? " remote__toast--visible" : ""}${
          toast && !toast.ok ? " remote__toast--err" : ""
        }`}
        aria-live="polite"
        role="status"
      >
        {toast?.message ??
          (mediaEnabled ? "Media controls active" : "D-pad + SELECT on launcher")}
      </div>

      {searchOpen ? (
        <div className="remote__search-sheet" role="dialog" aria-label="Search">
          <form className="remote__search-form" onSubmit={submitSearch}>
            <label className="remote__search-label" htmlFor="remote-search">
              Search
            </label>
            <input
              id="remote-search"
              ref={searchInputRef}
              type="search"
              enterKeyHint="search"
              autoCapitalize="off"
              autoCorrect="off"
              placeholder="Title, show, channel…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div className="remote__search-actions">
              <button
                type="button"
                className="remote__chip"
                onClick={() => {
                  setSearchOpen(false);
                  setSearchQuery("");
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="remote__chip remote__chip--accent"
                disabled={busy || !searchQuery.trim()}
              >
                Go
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </main>
  );
}
