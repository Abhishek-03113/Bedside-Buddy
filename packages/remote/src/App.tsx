import { useEffect, useState } from "react";
import type { SourceCapabilities } from "@coosy/shared";
import { DPadScreen } from "./screens/DPadScreen";
import { TransportScreen } from "./screens/TransportScreen";
import { createWsClient, type WsClient } from "./ws-client";

type Mode = "launcher" | "player" | "connecting";

export function App() {
  const [mode, setMode] = useState<Mode>("connecting");
  const [capabilities, setCapabilities] = useState<SourceCapabilities | null>(
    null,
  );
  const [client, setClient] = useState<WsClient | null>(null);
  const [status, setStatus] = useState("Connecting…");

  useEffect(() => {
    const host = window.location.hostname || "localhost";
    const wsPort = Number(
      new URLSearchParams(window.location.search).get("ws") ?? 17832,
    );
    const ws = createWsClient(`ws://${host}:${wsPort}`);

    ws.onHello((ack) => {
      setCapabilities(ack.capabilities);
      setMode(ack.activeSourceId ? "player" : "launcher");
      setStatus("Connected");
    });

    ws.onContext((ctx) => {
      setCapabilities(ctx.capabilities);
      setMode(ctx.mode);
    });

    ws.onClose(() => {
      setMode("connecting");
      setStatus("Reconnecting…");
    });

    setClient(ws);
    return () => ws.close();
  }, []);

  if (mode === "connecting" || !client) {
    return (
      <main className="remote remote--status">
        <h1>CoOSy</h1>
        <p>{status}</p>
      </main>
    );
  }

  if (mode === "player") {
    return (
      <TransportScreen
        client={client}
        capabilities={capabilities}
        onHome={() => void client.sendNav("home")}
      />
    );
  }

  return <DPadScreen client={client} />;
}
