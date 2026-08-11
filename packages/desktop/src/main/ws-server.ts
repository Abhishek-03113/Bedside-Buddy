/**
 * Back-compat entry — implementation lives in remote-server.ts
 * (HTTP static UI + WebSocket on one LAN port).
 */
export {
  startWsServer,
  startRemoteServer,
  buildContextMessage,
  resolveRemotePort,
  resolveRemoteStaticRoot,
  DEFAULT_REMOTE_PORT,
  type WsServer,
  type WsServerDeps,
  type RemoteServer,
  type RemoteServerDeps,
} from "./remote-server.js";
