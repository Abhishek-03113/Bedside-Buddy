import { networkInterfaces } from "node:os";

/**
 * Best-effort LAN IPv4 for QR / pairing fallback when mDNS is flaky.
 */
export function getLanIPv4(): string | null {
  const nets = networkInterfaces();
  for (const entries of Object.values(nets)) {
    if (!entries) continue;
    for (const entry of entries) {
      if (entry.family !== "IPv4") continue;
      if (entry.internal) continue;
      return entry.address;
    }
  }
  return null;
}
