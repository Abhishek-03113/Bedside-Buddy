#!/usr/bin/env node
/**
 * Castlabs EVS VMP afterPack hook for electron-builder.
 *
 * Purpose:
 *   After electron-builder unpacks the application (but before the NSIS/DMG
 *   installer is assembled), sign the application directory using the
 *   Castlabs EVS VMP tool.
 *
 *   This gives the packaged Electron runtime a production Widevine VMP
 *   signature, which is required by production DRM license servers that
 *   enforce client trust (such as Netflix production tiers).
 *
 * Usage:
 *   This script is referenced in electron-builder.yml as `afterPack`.
 *   electron-builder calls it automatically during packaging.
 *
 * Environment variables:
 *   COOSY_REQUIRE_VMP_SIGNING=1
 *     If set, signing failure is treated as a BUILD FAILURE.
 *     Do NOT set this in development unless EVS credentials are available.
 *
 *   All EVS credentials come from the local EVS configuration:
 *     python -m castlabs_evs.account signin
 *   NEVER store EVS tokens or passwords in this file or the repository.
 *
 * See docs/widevine-vmp.md for full EVS authentication documentation.
 *
 * @param {import('electron-builder').AfterPackContext} context
 */

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Resolve the best available Python executable on the current platform.
 * Returns null if no usable Python is found.
 * @returns {string|null}
 */
function resolvePython() {
  /** @type {string[]} */
  const candidates =
    process.platform === "win32"
      ? ["py", "python", "python3"]
      : ["python3", "python"];

  for (const candidate of candidates) {
    try {
      execFileSync(candidate, ["--version"], { stdio: "pipe" });
      return candidate;
    } catch {
      // not available — try next
    }
  }
  return null;
}

/**
 * @param {import('electron-builder').AfterPackContext} context
 */
export default async function vmpSign(context) {
  const { appOutDir, electronPlatformName, arch } = context;

  console.log("[vmp] afterPack hook invoked");
  console.log("[vmp] platform:", electronPlatformName);
  console.log("[vmp] arch:", arch);
  console.log("[vmp] app output directory:", appOutDir);

  const requireSigning = process.env.COOSY_REQUIRE_VMP_SIGNING === "1";

  // Only sign Windows and macOS — ECS supports both.
  // Linux ECS has partial Widevine support and signing is not a typical step.
  const supportedPlatforms = ["win32", "darwin"];
  if (!supportedPlatforms.includes(electronPlatformName)) {
    console.log(
      `[vmp] skipping VMP signing — platform ${electronPlatformName} is not a supported VMP signing target`,
    );
    return;
  }

  // Verify the output directory exists before attempting to sign it.
  if (!existsSync(appOutDir)) {
    const msg = `[vmp] app output directory does not exist: ${appOutDir}`;
    if (requireSigning) {
      throw new Error(msg);
    }
    console.warn(msg);
    return;
  }

  const python = resolvePython();
  if (!python) {
    const msg =
      "[vmp] Python not found — cannot run castlabs_evs.vmp.\n" +
      "      Install Python 3 and run: pip install --upgrade castlabs-evs\n" +
      "      Then authenticate: python -m castlabs_evs.account signin";

    if (requireSigning) {
      throw new Error(msg);
    }
    console.warn(msg);
    console.log(
      "[vmp] COOSY_REQUIRE_VMP_SIGNING is not set — continuing with Castlabs development-signed runtime",
    );
    return;
  }

  // Check whether the EVS module is importable before running.
  try {
    execFileSync(python, ["-c", "import castlabs_evs"], { stdio: "pipe" });
  } catch {
    const msg =
      "[vmp] castlabs_evs Python package not installed.\n" +
      `      Run: ${python} -m pip install --upgrade castlabs-evs\n` +
      "      Then authenticate: python -m castlabs_evs.account signin";

    if (requireSigning) {
      throw new Error(msg);
    }
    console.warn(msg);
    console.log(
      "[vmp] COOSY_REQUIRE_VMP_SIGNING is not set — continuing without VMP signing",
    );
    return;
  }

  // The signing target is the application directory (appOutDir).
  // For Windows this is the win-unpacked directory containing the ECS runtime.
  // Do NOT sign the NSIS installer .exe itself — EVS VMP operates on the
  // Electron runtime directory, not the final installer artifact.
  const signingTarget = appOutDir;
  console.log("[vmp] signing application directory:", signingTarget);

  // On Windows when cross-building from macOS, appOutDir is the unpacked app
  // directory that will be packed into the NSIS installer.  Sign it here so
  // the Widevine runtime inside carries the VMP signature.
  try {
    execFileSync(
      python,
      ["-m", "castlabs_evs.vmp", "sign-pkg", signingTarget],
      {
        stdio: "inherit",
        // EVS reads credentials from its own local configuration — do not
        // pass any secrets via env vars here.
      },
    );
    console.log("[vmp] VMP signing completed successfully");
  } catch (err) {
    const msg =
      "[vmp] EVS VMP signing FAILED.\n" +
      "      Ensure you have authenticated: python -m castlabs_evs.account signin\n" +
      "      Error: " +
      String(err);

    // Signing failure is always a hard error when explicitly required.
    if (requireSigning) {
      throw new Error(msg);
    }

    // If signing is optional (dev builds) warn loudly but do not abort.
    // The packaged app will use the Castlabs development-signed runtime.
    console.error(msg);
    console.log(
      "[vmp] Continuing with Castlabs development-signed runtime.\n" +
        "      Set COOSY_REQUIRE_VMP_SIGNING=1 to make signing failures fatal.",
    );
  }

  // Locate the VMP keybox/manifest file if EVS wrote one, for log confirmation.
  const vmpManifest = join(signingTarget, "vmp.hfu");
  if (existsSync(vmpManifest)) {
    console.log("[vmp] vmp.hfu manifest present in signed output");
  }
}
