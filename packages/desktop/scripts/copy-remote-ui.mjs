#!/usr/bin/env node
/**
 * Copy built @coosy/remote assets into desktop out/remote for packaged HTTP serving.
 */
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const desktopRoot = join(__dirname, "..");
const source = join(desktopRoot, "..", "remote", "dist");
const dest = join(desktopRoot, "out", "remote");

if (!existsSync(join(source, "index.html"))) {
  console.error(
    `[copy-remote-ui] Missing ${source}/index.html — build @coosy/remote first`,
  );
  process.exit(1);
}

rmSync(dest, { recursive: true, force: true });
mkdirSync(dirname(dest), { recursive: true });
cpSync(source, dest, { recursive: true });
console.log(`[copy-remote-ui] ${source} → ${dest}`);
