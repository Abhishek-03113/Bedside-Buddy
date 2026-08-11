import { getAppState, setAppState } from "./db/db.js";

const PAIRING_CODE_KEY = "pairing_code";
const TRUSTED_CLIENTS_KEY = "trusted_clients";

function randomDigits(length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += String(Math.floor(Math.random() * 10));
  }
  return out;
}

export function getOrCreatePairingCode(): string {
  const existing = getAppState(PAIRING_CODE_KEY);
  if (existing && /^\d{6}$/.test(existing)) return existing;

  const code = randomDigits(6);
  setAppState(PAIRING_CODE_KEY, code);
  return code;
}

export function rotatePairingCode(): string {
  const code = randomDigits(6);
  setAppState(PAIRING_CODE_KEY, code);
  return code;
}

function readTrusted(): string[] {
  const raw = getAppState(TRUSTED_CLIENTS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

export function isTrustedClient(clientId: string): boolean {
  return readTrusted().includes(clientId);
}

export function trustClient(clientId: string): void {
  const set = new Set(readTrusted());
  set.add(clientId);
  setAppState(TRUSTED_CLIENTS_KEY, JSON.stringify([...set]));
}

export function authorizeHello(opts: {
  clientId: string;
  pairingCode?: string;
}): { ok: true } | { ok: false; reason: string } {
  if (isTrustedClient(opts.clientId)) {
    return { ok: true };
  }

  const expected = getOrCreatePairingCode();
  if (opts.pairingCode && opts.pairingCode === expected) {
    trustClient(opts.clientId);
    return { ok: true };
  }

  return {
    ok: false,
    reason: "pairing required — enter the code shown on the TV",
  };
}
