#!/usr/bin/env node
/**
 * Minimal WS smoke client against the laptop remote server.
 *
 * Usage:
 *   node packages/desktop/scripts/ws-smoke.mjs [wsUrl] [pairingCode]
 *
 * Example (same port serves HTTP UI + WS):
 *   node packages/desktop/scripts/ws-smoke.mjs ws://127.0.0.1:17832 123456
 */
import WebSocket from "ws";
import { randomUUID } from "node:crypto";

const url = process.argv[2] ?? "ws://127.0.0.1:17832";
const pairingCode = process.argv[3];
const clientId = randomUUID();

if (!pairingCode) {
  console.error("Usage: node ws-smoke.mjs <wsUrl> <pairingCode>");
  process.exit(1);
}

const ws = new WebSocket(url);

ws.on("open", () => {
  console.log("open", url);
  ws.send(
    JSON.stringify({
      kind: "hello",
      clientId,
      pairingCode,
    }),
  );
});

ws.on("message", (raw) => {
  const msg = JSON.parse(String(raw));
  console.log("←", msg);

  if (msg.kind === "hello-ack") {
    const requestId = randomUUID();
    ws.send(
      JSON.stringify({
        kind: "command",
        requestId,
        command: { type: "toggle-play-pause" },
      }),
    );
  }

  if (msg.kind === "command-result") {
    setTimeout(() => ws.close(), 200);
  }
});

ws.on("error", (err) => {
  console.error(err);
  process.exit(1);
});
