#!/usr/bin/env node

/**
 * Generate icon sizes from source SVG
 * Creates PNG icons at different resolutions for the Chrome extension
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.dirname(path.dirname(__filename));

const sourceIcon = path.join(projectRoot, "icons", "sources", "download-source.svg");
const sizes = [32, 48, 96, 128];
const iconsDir = path.join(projectRoot, "icons");

async function generateIcons() {
  console.log("🎨 Generating icons from SVG...\n");

  for (const size of sizes) {
    const outputPath = path.join(iconsDir, `${size}_download.png`);

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

  console.log("\n✨ All icons generated successfully!");
}

generateIcons();
