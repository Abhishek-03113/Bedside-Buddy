import { Component, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import type {
  RemoteSourceSummary,
  SourceCapabilities,
} from "@coosy/shared";
import { RemoteControls } from "./screens/RemoteControls";
import { useRemoteToast } from "./use-remote-toast";
import {
  createWsClient,
  resolveWsUrl,
  type ConnectionStatus,
  type WsClient,
} from "./ws-client";

type Mode = "launcher" | "player";

class RemoteErrorBoundary extends Component<
  { children: ReactNode },
  { error: string | null }
> {
  state = { error: null as string | null };

  static getDerivedStateFromError(error: unknown) {
    return {
      error: error instanceof Error ? error.message : String(error),
    };
  }

  render() {
    if (this.state.error) {
      return (
        <main className="remote remote--status">
          <h1>CoOSy</h1>
          <p className="remote__status remote__status--disconnected">ERROR</p>
          <p className="remote__error">{this.state.error}</p>
          <p className="remote__hint">Refresh the page after restarting CoOSy on the laptop.</p>
        </main>
      );
    }
    return this.props.children;
  }
}

function RemoteApp() {
  const [client, setClient] = useState<WsClient | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("CONNECTING");
  const [mode, setMode] = useState<Mode>("launcher");
  const [activeSourceId, setActiveSourceId] = useState<string | null>(null);
  const [sources, setSources] = useState<RemoteSourceSummary[]>([]);
  const [capabilities, setCapabilities] = useState<SourceCapabilities | null>(
    null,
  );
  const [needsPairing, setNeedsPairing] = useState(false);
  const [pairingCode, setPairingCode] = useState("");
  const [pairingError, setPairingError] = useState<string | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const { toast, show: showToast, clear: clearToast } = useRemoteToast();

  useEffect(() => {
    try {
      const url = resolveWsUrl({
        hostname: window.location.hostname,
        search: window.location.search,
        protocol: window.location.protocol,
        port: window.location.port,
      });
      const ws = createWsClient({ url });

      ws.onStatus(setStatus);

      ws.onHello((ack) => {
        setNeedsPairing(false);
        setPairingError(null);
        setCapabilities(ack.capabilities);
        setActiveSourceId(ack.activeSourceId);
        setMode(ack.mode ?? (ack.activeSourceId ? "player" : "launcher"));
        setSources(ack.sources ?? []);
        clearToast();
      });

      ws.onContext((ctx) => {
        setCapabilities(ctx.capabilities);
        setActiveSourceId(ctx.activeSourceId);
        setMode(ctx.mode);
        setSources(ctx.sources ?? []);
      });

      ws.onError((message) => {
        if (message.includes("pairing") || message.includes("not paired")) {
          setNeedsPairing(true);
          setPairingError(message);
        } else {
          showToast({ message, ok: false });
        }
      });

      ws.onToast((payload) => {
        showToast(payload);
      });

      setClient(ws);
      return () => ws.close();
    } catch (err) {
      setBootError(err instanceof Error ? err.message : String(err));
      return undefined;
    }
    // Mount-only WS session; toast helpers are stable via useCallback.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- connect once
  }, []);

  const activeSourceName = useMemo(() => {
    if (!activeSourceId) return null;
    return (
      sources.find((s) => s.id === activeSourceId)?.displayName ?? activeSourceId
    );
  }, [activeSourceId, sources]);

  const submitPairing = (event: FormEvent) => {
    event.preventDefault();
    client?.setPairingCode(pairingCode);
  };

  if (bootError) {
    return (
      <main className="remote remote--status">
        <h1>CoOSy</h1>
        <p className="remote__status remote__status--disconnected">ERROR</p>
        <p className="remote__error">{bootError}</p>
      </main>
    );
  }

  if (status === "CONNECTED" && client && !needsPairing) {
    return (
      <RemoteControls
        client={client}
        status={status}
        mode={mode}
        activeSourceName={activeSourceName}
        capabilities={capabilities}
        toast={toast}
        onToast={showToast}
      />
    );
  }

  return (
    <main className="remote remote--status">
      <h1>CoOSy</h1>
      <p
        className={`remote__status remote__status--${status.toLowerCase()}`}
        aria-live="polite"
      >
        {status}
      </p>
      <p className="remote__hint">
        {needsPairing || status === "DISCONNECTED"
          ? "Enter the 6-digit code shown on the CoOSy TV / laptop."
          : "Looking for the laptop on this Wi-Fi…"}
      </p>
      <form className="remote__pair" onSubmit={submitPairing}>
        <input
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          autoComplete="one-time-code"
          placeholder="000000"
          value={pairingCode}
          onChange={(e) =>
            setPairingCode(e.target.value.replace(/\D/g, "").slice(0, 6))
          }
          aria-label="Pairing code"
        />
        <button type="submit" disabled={!client || pairingCode.length !== 6}>
          Pair
        </button>
      </form>
      {pairingError ? <p className="remote__error">{pairingError}</p> : null}
      {toast ? (
        <p
          className={`remote__toast remote__toast--visible${
            toast.ok ? "" : " remote__toast--err"
          }`}
          aria-live="polite"
        >
          {toast.message}
        </p>
      ) : null}
    </main>
  );
}

export function App() {
  return (
    <RemoteErrorBoundary>
      <RemoteApp />
    </RemoteErrorBoundary>
  );
}
