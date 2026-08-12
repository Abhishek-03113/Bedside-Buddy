import { app, components } from "electron";

/**
 * Log DRM-relevant runtime versions for E100 diagnostics.
 * Call this before any other DRM operation so logs appear first.
 */
function logDrmRuntime(): void {
  console.log("[drm] runtime info:", {
    app: app.getVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    platform: process.platform,
    arch: process.arch,
  });
}

/**
 * Wait for Widevine CDM via Castlabs ECS Component Updater (wvcus architecture).
 *
 * STRICT MODE: If the `components` API is unavailable this function THROWS
 * rather than silently continuing.  Netflix / DRM playback cannot succeed
 * without the Castlabs ECS runtime; surfacing the failure immediately is
 * better than a mysterious E100 later.
 *
 * See docs/widevine-vmp.md for the full E100 diagnostic decision tree.
 */
export async function ensureWidevineReady(): Promise<void> {
  logDrmRuntime();

  if (!components?.whenReady) {
    throw new Error(
      "[widevine] Castlabs ECS components API is unavailable. " +
        "CoOSy must run using the Castlabs ECS Electron runtime (v42.8.0+wvcus). " +
        "Do NOT use stock Electron — it does not provide Widevine CDM. " +
        "See docs/widevine-vmp.md for setup instructions.",
    );
  }

  console.log("[widevine] waiting for Widevine component updater…");
  await components.whenReady();

  const status = components.status();
  console.log("[widevine] components ready");
  // Log as JSON so the CDM name/version/status fields are clearly readable in
  // log files without relying on Node's object inspector formatting.
  console.log("[widevine] component status:", JSON.stringify(status, null, 2));
}
