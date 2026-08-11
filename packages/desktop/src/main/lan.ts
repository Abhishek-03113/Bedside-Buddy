import { networkInterfaces } from "node:os";

function scoreLanAddress(address: string): number {
  // Prefer typical home Wi-Fi over VPN / Docker / virtual NICs.
  if (address.startsWith("192.168.")) return 100;
  if (/^10\./.test(address)) return 80;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(address)) return 20; // often VPN
  return 10;
}

/**
 * Best-effort LAN IPv4 for QR / pairing fallback when mDNS is flaky.
 */
export function getLanIPv4(): string | null {
  const nets = networkInterfaces();
  let best: { address: string; score: number } | null = null;

  for (const entries of Object.values(nets)) {
    if (!entries) continue;
    for (const entry of entries) {
      if (entry.family !== "IPv4" && entry.family !== 4) continue;
      if (entry.internal) continue;
      const score = scoreLanAddress(entry.address);
      if (!best || score > best.score) {
        best = { address: entry.address, score };
      }
    }
  }

  return best?.address ?? null;
}
