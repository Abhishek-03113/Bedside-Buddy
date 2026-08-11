import { useState } from "react";
import type { RemoteCommand, SourceCapabilities } from "@coosy/shared";
import type { ConnectionStatus, WsClient } from "../ws-client";

interface RemoteControlsProps {
  client: WsClient;
  status: ConnectionStatus;
  mode: "launcher" | "player";
  activeSourceName: string | null;
  capabilities: SourceCapabilities | null;
  feedback: string | null;
  onFeedback: (message: string | null) => void;
}

/**
 * Minimal phone remote: status + source + D-pad + transport.
 * Source-agnostic — never branches on Netflix/YouTube/etc.
 */
export function RemoteControls({
  client,
  status,
  mode,
  activeSourceName,
  capabilities,
  feedback,
  onFeedback,
}: RemoteControlsProps) {
  const [busy, setBusy] = useState(false);

  const pressNav = async (
    action: "up" | "down" | "left" | "right" | "select" | "back" | "home",
  ) => {
    try {
      await client.sendNav(action);
      onFeedback(`nav:${action}`);
    } catch {
      onFeedback("Not connected — command not sent");
    }
  };

  const pressCommand = async (command: RemoteCommand) => {
    setBusy(true);
    try {
      const result = await client.sendCommand(command);
      if (result.ok) {
        onFeedback(command.type);
      } else {
        onFeedback(`${command.type} failed (${result.reason})`);
      }
    } catch {
      onFeedback("Connection lost — command not sent");
    } finally {
      setBusy(false);
    }
  };

  const seek = capabilities?.supportsSeek ?? true;
  const volume = capabilities?.supportsVolume ?? true;
  const mediaEnabled = mode === "player";

  return (
    <main className="remote">
      <header className="remote__header">
        <h1 className="remote__title">CoOSy</h1>
        <p
          className={`remote__status remote__status--${status.toLowerCase()}`}
          aria-live="polite"
        >
          {status}
        </p>
      </header>

      <p className="remote__source" aria-live="polite">
        {mode === "player" && activeSourceName
          ? activeSourceName
          : "Launcher"}
      </p>

      <div className="dpad" role="group" aria-label="D-pad">
        <button
          type="button"
          className="dpad__btn dpad__up"
          onClick={() => void pressNav("up")}
        >
          ▲
        </button>
        <button
          type="button"
          className="dpad__btn dpad__left"
          onClick={() => void pressNav("left")}
        >
          ◀
        </button>
        <button
          type="button"
          className="dpad__btn dpad__select"
          onClick={() => void pressNav("select")}
        >
          OK
        </button>
        <button
          type="button"
          className="dpad__btn dpad__right"
          onClick={() => void pressNav("right")}
        >
          ▶
        </button>
        <button
          type="button"
          className="dpad__btn dpad__down"
          onClick={() => void pressNav("down")}
        >
          ▼
        </button>
      </div>

      <div className="remote__row">
        <button
          type="button"
          className="remote__chip"
          onClick={() => void pressNav("back")}
        >
          Back
        </button>
        <button
          type="button"
          className="remote__chip remote__chip--accent"
          onClick={() => void pressNav("home")}
        >
          Home
        </button>
      </div>

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

      {feedback ? (
        <p className="remote__feedback" aria-live="polite">
          {feedback}
        </p>
      ) : (
        <p className="remote__hint">
          {mediaEnabled
            ? "Media controls active"
            : "Use D-pad + OK on the launcher"}
        </p>
      )}
    </main>
  );
}
