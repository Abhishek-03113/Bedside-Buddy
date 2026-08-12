#!/usr/bin/env node
/**
 * Development VMP signing script for CoOSy.
 *
 * Purpose:
 *   Sign the locally installed Castlabs ECS Electron runtime using the
 *   Castlabs EVS VMP tool.  This is required for DRM playback in development
 *   environments where the ECS development-signed binary is not sufficient.
 *
 * Usage:
 *   From packages/desktop/:
 *     pnpm drm:sign:electron
 *
 *   Or directly:
 *     node packages/desktop/scripts/sign-electron-vmp.mjs
 *
 * Prerequisites:
 *   1. Python 3 installed (macOS: python3, Windows: py / python)
 *   2. castlabs-evs installed:
 *        python3 -m pip install --upgrade castlabs-evs
 *   3. EVS account authenticated:
 *        python3 -m castlabs_evs.account signin
 *
 * What this does:
 *   Runs:  python -m castlabs_evs.vmp sign-pkg <electron-dist-dir>
 *
 *   This modifies the locally installed ECS Electron runtime files so they
 *   carry the EVS VMP signature.  It does NOT:
 *     - Sign the application source code
 *     - Sign the NSIS installer
 *     - Download or modify the Widevine CDM
 *     - Bypass any DRM verification
 *
 * IMPORTANT:
 *   This operation modifies files inside node_modules/electron/dist/.
 *   Re-run after every `pnpm install` that updates the electron package.
 *
 * See docs/widevine-vmp.md for full documentation.
 */

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..", "..");

/**
 * Resolve the best available Python 3 executable on the current platform.
 * Prefers .venv/bin/python if available.
 * @returns {string} The Python executable name or path.
 * @throws {Error} If no usable Python is found.
 */
function resolvePython() {
  /** @type {string[]} */
  const venvCandidates =
    process.platform === "win32"
      ? [join(repoRoot, ".venv", "Scripts", "python.exe")]
      : [join(repoRoot, ".venv", "bin", "python")];

  const systemCandidates =
    process.platform === "win32"
      ? ["py", "python", "python3"]
      : ["python3", "python"];

  const candidates = [...venvCandidates, ...systemCandidates];

  for (const candidate of candidates) {
    try {
      const result = execFileSync(candidate, ["--version"], {
        stdio: "pipe",
        encoding: "utf8",
      });
      const version = result.trim();
      console.log(`[vmp] found Python: ${candidate} (${version})`);
      return candidate;
    } catch {
      // not available — try next
    }
  }

  throw new Error(
    "[vmp] Python not found on PATH.\n" +
      "      macOS/Linux: install python3 (e.g. brew install python3)\n" +
      "      Windows:     install from https://python.org — ensure 'py' launcher is available\n" +
      "      Then run: python3 -m pip install --upgrade castlabs-evs",
  );
}

/**
 * Resolve the Electron distribution directory.
 * Uses Node's require resolution from the desktop package root so it works
 * regardless of whether the script is run from repo root or packages/desktop.
 * @returns {string} Absolute path to the electron dist directory.
 */
function resolveElectronDist() {
  // The sign-electron-vmp.mjs lives in packages/desktop/scripts/
  // The electron package lives in packages/desktop/node_modules/electron/
  const desktopRoot = join(__dirname, "..");

  // Use createRequire to resolve relative to the desktop package.
  const require = createRequire(join(desktopRoot, "package.json"));

  let electronDir;
  try {
    // electron's main export resolves to its dist/electron (or electron.exe)
    // We need the directory, so resolve to its package root.
    const electronMain = require.resolve("electron");
    // electron main = node_modules/electron/index.js
    // electron package root = node_modules/electron/
    electronDir = dirname(electronMain);
  } catch {
    throw new Error(
      "[vmp] Could not resolve the `electron` package.\n" +
        "      Ensure pnpm install has been run from packages/desktop/ or the repo root.",
    );
  }

  // The actual Electron binaries live in node_modules/electron/dist/
  const distDir = join(electronDir, "dist");
  if (!existsSync(distDir)) {
    throw new Error(
      `[vmp] Electron dist directory not found: ${distDir}\n` +
        "      The electron package may not be fully installed.\n" +
        "      Run: pnpm install",
    );
  }

  return distDir;
}

async function main() {
  console.log("[vmp] CoOSy — development Electron VMP signing");
  console.log("[vmp] platform:", process.platform);

  const python = resolvePython();

  // Verify castlabs_evs is importable.
  try {
    execFileSync(python, ["-c", "import castlabs_evs"], { stdio: "pipe" });
    console.log("[vmp] castlabs_evs package: found");
  } catch {
    throw new Error(
      "[vmp] castlabs_evs Python package is not installed.\n" +
        `      Run: ${python} -m pip install --upgrade castlabs-evs\n` +
        "      Then authenticate your EVS account:\n" +
        `      ${python} -m castlabs_evs.account signin`,
    );
  }

  const electronDist = resolveElectronDist();
  console.log("[vmp] signing Electron runtime at:", electronDist);
  console.log("[vmp] running: castlabs_evs.vmp sign-pkg …");

  try {
    execFileSync(
      python,
      ["-m", "castlabs_evs.vmp", "sign-pkg", electronDist],
      { stdio: "inherit" },
    );
  } catch (err) {
    throw new Error(
      "[vmp] EVS VMP signing FAILED.\n" +
        "      Make sure you are authenticated:\n" +
        `      ${python} -m castlabs_evs.account signin\n` +
        "\n" +
        "      If you do not have a Castlabs EVS account:\n" +
        "      - Development builds use the Castlabs development-signed ECS binary.\n" +
        "      - Only production deployments require EVS signing.\n" +
        "      See docs/widevine-vmp.md for more information.\n" +
        "\n" +
        "      Original error: " +
        String(err),
    );
  }

  console.log("[vmp] VMP signing completed successfully");
  
  // On macOS, re-sign the app bundle with ad-hoc signature to fix ENOEXEC errors
  if (process.platform === "darwin") {
    console.log("[vmp] Re-signing Electron.app for macOS...");
    const appPath = join(electronDist, "Electron.app");
    try {
      execFileSync("codesign", ["--force", "--deep", "--sign", "-", appPath], {
        stdio: "pipe",
      });
      console.log("[vmp] macOS code signature applied successfully");
    } catch (err) {
      console.warn("[vmp] Warning: Could not re-sign Electron.app:", err.message);
      console.warn("[vmp] You may need to run manually:");
      console.warn(`[vmp]   codesign --force --deep --sign - "${appPath}"`);
    }
  }
  
  console.log("[vmp] The local Electron runtime is now VMP-signed for development use.");
  console.log("[vmp] Re-run this script after every `pnpm install` that updates electron.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
