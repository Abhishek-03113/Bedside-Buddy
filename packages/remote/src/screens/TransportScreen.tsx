import type { RemoteCommand, SourceCapabilities } from "@coosy/shared";
import type { WsClient } from "../ws-client";

interface TransportScreenProps {
  client: WsClient;
  capabilities: SourceCapabilities | null;
  onHome: () => void;
}

/** Buttons enabled from SourceCapabilities — never hardcode Netflix rules. */
export function TransportScreen({
  client,
  capabilities,
  onHome,
}: TransportScreenProps) {
  const send = (command: RemoteCommand) => void client.sendCommand(command);

  const seek = capabilities?.supportsSeek ?? false;
  const next = capabilities?.supportsNextEpisode ?? false;
  const volume = capabilities?.supportsVolume ?? false;

  return (
    <main className="remote">
      <h1 className="remote__title">Playback</h1>

      <div className="transport">
        <button type="button" onClick={() => send({ type: "toggle-play-pause" })}>
          Play / Pause
        </button>
        <button
          type="button"
          disabled={!seek}
          onClick={() => send({ type: "seek", deltaSeconds: -10 })}
        >
          −10s
        </button>
        <button
          type="button"
          disabled={!seek}
          onClick={() => send({ type: "seek", deltaSeconds: 10 })}
        >
          +10s
        </button>
        <button
          type="button"
          disabled={!next}
          onClick={() => send({ type: "next-episode" })}
        >
          Next episode
        </button>
        <button
          type="button"
          disabled={!volume}
          onClick={() => send({ type: "volume", direction: "down" })}
        >
          Vol −
        </button>
        <button
          type="button"
          disabled={!volume}
          onClick={() => send({ type: "volume", direction: "up" })}
        >
          Vol +
        </button>
      </div>

      <button type="button" className="remote__secondary" onClick={onHome}>
        Home
      </button>
    </main>
  );
}
