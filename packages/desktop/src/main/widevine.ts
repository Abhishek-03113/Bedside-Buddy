import { components } from "electron";

/**
 * Wait for Widevine CDM (castlabs ECS). Safe no-op if `components` is missing
 * (e.g. accidental stock Electron), but DRM playback will fail.
 * See docs/widevine-spike.md.
 */
export async function ensureWidevineReady(): Promise<void> {
  if (!components?.whenReady) {
    console.warn(
      "[widevine] components API missing — not running castlabs ECS; DRM will fail",
    );
    return;
  }

  await components.whenReady();
  console.log("[widevine] components ready:", components.status());
}
