import { Bonjour } from "bonjour-service";

const SERVICE_NAME = "CoOSy";
const SERVICE_TYPE = "coosy";

/**
 * Advertise the remote WebSocket/HTTP endpoint on the LAN via mDNS.
 * Fallback (QR / IP display) lives in the renderer — see PRD §7.
 */
export async function startDiscovery(port: number): Promise<() => void> {
  const bonjour = new Bonjour();

  const service = bonjour.publish({
    name: SERVICE_NAME,
    type: SERVICE_TYPE,
    port,
    protocol: "tcp",
  });

  console.log(`[discovery] advertising ${SERVICE_NAME}._${SERVICE_TYPE}._tcp on :${port}`);

  return () => {
    service.stop();
    bonjour.destroy();
  };
}
