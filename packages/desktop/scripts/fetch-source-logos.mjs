/**
 * One-time (re-runnable) fetch of source logos into renderer public assets.
 * Icons are served as static files under /assets/sources/*.svg.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const targetDir = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../src/renderer/public/assets/sources",
);

/**
 * Compact brand marks for launcher tiles and Continue Watching fallbacks.
 * Hotstar has no maintained Simple Icons mark, so we keep a local play glyph.
 */
const logos = {
  netflix: {
    url: "https://api.iconify.design/simple-icons:netflix.svg?color=%23E50914",
  },
  youtube: {
    url: "https://api.iconify.design/simple-icons:youtube.svg?color=%23FF0000",
  },
  prime: {
    url: "https://api.iconify.design/simple-icons:primevideo.svg?color=%2300A8E1",
  },
  hotstar: {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" role="img" aria-label="Hotstar"><title>Hotstar</title><rect width="24" height="24" rx="5" fill="#0F8BDC"/><path fill="#fff" d="M9.2 6.8v10.4L18.4 12 9.2 6.8z"/></svg>`,
  },
};

const headers = {
  "User-Agent": "CoosyLogoFetch/1.0 (local asset bootstrap)",
  Accept: "image/svg+xml,text/plain,*/*",
};

await mkdir(targetDir, { recursive: true });
for (const [name, source] of Object.entries(logos)) {
  let svg;
  if ("svg" in source) {
    svg = source.svg.trim();
  } else {
    const response = await fetch(source.url, { headers });
    if (!response.ok) {
      throw new Error(`Could not fetch ${name} logo: ${response.status} ${source.url}`);
    }
    svg = (await response.text()).trim();
  }
  if (!svg.includes("<svg")) {
    throw new Error(`Unexpected non-SVG payload for ${name}`);
  }
  await writeFile(resolve(targetDir, `${name}.svg`), `${svg}\n`, "utf8");
  console.log(`wrote ${name}.svg (${svg.length} bytes)`);
}
