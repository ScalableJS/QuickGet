#!/usr/bin/env node

/**
 * Generate icon sizes from source SVG
 * Creates PNG icons at different resolutions for the Chrome extension
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.dirname(path.dirname(__filename));

const sizes = [32, 48, 96, 128];
const iconsDir = path.join(projectRoot, "icons");
const sourcesDir = path.join(iconsDir, "sources");
// Runtime-swapped icons must live in public/ so Vite copies them verbatim into
// the build — crxjs only bundles files referenced from the manifest.
const publicIconsDir = path.join(projectRoot, "public", "icons");

// Each variant renders its SVG source to `{outDir}/{size}_{suffix}.png`.
// - download: the manifest icon set, managed by crxjs from icons/
// - active: loaded at runtime via chrome.action.setIcon, copied via public/
const variants = [
  { source: "download-source.svg", suffix: "download", outDir: iconsDir },
  { source: "download-active-source.svg", suffix: "active", outDir: publicIconsDir },
];

async function generateIcons() {
  console.log("🎨 Generating icons from SVG...\n");

  for (const { source, suffix, outDir } of variants) {
    const sourceIcon = path.join(sourcesDir, source);
    await fs.mkdir(outDir, { recursive: true });

    for (const size of sizes) {
      const outputPath = path.join(outDir, `${size}_${suffix}.png`);

      try {
        await sharp(sourceIcon)
          .resize(size, size, {
            fit: "contain",
            background: { r: 0, g: 0, b: 0, alpha: 0 },
          })
          .png()
          .toFile(outputPath);

        console.log(`✅ Created ${size}x${size} icon: ${path.relative(process.cwd(), outputPath)}`);
      } catch (error) {
        console.error(`❌ Failed to create ${size}x${size} icon:`, error);
        process.exit(1);
      }
    }
  }

  console.log("\n✨ All icons generated successfully!");
}

generateIcons();
