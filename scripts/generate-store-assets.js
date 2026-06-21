#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.dirname(path.dirname(__filename));
const assetsRoot = path.join(projectRoot, "store-assets");
const cacheRoot = path.join(assetsRoot, ".cache");
const screenshotsRoot = path.join(assetsRoot, "screenshots");
const promoRoot = path.join(assetsRoot, "promo");
const iconPath = path.join(projectRoot, "icons", "128_download.png");

await generateStoreAssets();

async function generateStoreAssets() {
  await fs.mkdir(screenshotsRoot, { recursive: true });
  await fs.mkdir(promoRoot, { recursive: true });

  await Promise.all([
    createScreenshot("downloads", "Manage QNAP downloads from Chrome"),
    createScreenshot("settings", "Connect directly to your QNAP NAS"),
    createPromo("small-440x280.png", 440, 280),
    createPromo("marquee-1400x560.png", 1400, 560),
  ]);
}

async function createScreenshot(name, subtitle) {
  const image = await sharp(path.join(cacheRoot, `${name}.png`))
    .png()
    .toBuffer();
  const metadata = await sharp(image).metadata();
  const panelWidth = 460;
  const panelHeight = Math.round((panelWidth / (metadata.width ?? panelWidth)) * (metadata.height ?? 700));
  const panel = await sharp(image).resize(panelWidth).png().toBuffer();
  const shadow = await sharp({
    create: { width: panelWidth + 30, height: panelHeight + 30, channels: 4, background: "#0f172a40" },
  })
    .blur(14)
    .png()
    .toBuffer();
  const icon = await sharp(iconPath).resize(76, 76).png().toBuffer();
  const text = renderText({ width: 1280, title: "QuickGet Remote", subtitle });

  await sharp({ create: { width: 1280, height: 800, channels: 4, background: "#0f172a" } })
    .composite([
      { input: renderBackground(1280, 800), top: 0, left: 0 },
      { input: icon, top: 78, left: 112 },
      { input: text, top: 82, left: 212 },
      { input: shadow, top: 241, left: 395 },
      { input: panel, top: 226, left: 410 },
    ])
    .flatten({ background: "#0f172a" })
    .removeAlpha()
    .png()
    .toFile(path.join(screenshotsRoot, `${name}-1280x800.png`));
}

async function createPromo(fileName, width, height) {
  const icon = await sharp(iconPath)
    .resize(Math.round(height * 0.28))
    .png()
    .toBuffer();
  const titleSize = Math.max(30, Math.round(width * 0.06));
  const text = Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <style>
        .title { fill: #f8fafc; font: 700 ${titleSize}px Arial, sans-serif; }
        .subtitle { fill: #cbd5e1; font: 400 ${Math.max(16, Math.round(titleSize * 0.42))}px Arial, sans-serif; }
      </style>
      <text x="${Math.round(width * 0.1)}" y="${Math.round(height * 0.72)}" class="title">QuickGet Remote</text>
      <text x="${Math.round(width * 0.1)}" y="${Math.round(height * 0.84)}" class="subtitle">for QNAP Download Station</text>
    </svg>
  `);

  await sharp({ create: { width, height, channels: 4, background: "#0f172a" } })
    .composite([
      { input: renderBackground(width, height), top: 0, left: 0 },
      { input: icon, top: Math.round(height * 0.15), left: Math.round(width * 0.1) },
      { input: text, top: 0, left: 0 },
    ])
    .flatten({ background: "#0f172a" })
    .removeAlpha()
    .png()
    .toFile(path.join(promoRoot, fileName));
}

function renderBackground(width, height) {
  return Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#0f172a"/>
      <circle cx="${Math.round(width * 0.88)}" cy="${Math.round(height * 0.15)}" r="${Math.round(height * 0.72)}" fill="#2563eb" opacity="0.38"/>
      <circle cx="${Math.round(width * 0.96)}" cy="${Math.round(height * 0.94)}" r="${Math.round(height * 0.56)}" fill="#38bdf8" opacity="0.2"/>
    </svg>
  `);
}

function renderText({ width, title, subtitle }) {
  return Buffer.from(`
    <svg width="${width}" height="130" xmlns="http://www.w3.org/2000/svg">
      <style>
        .title { fill: #f8fafc; font: 700 42px Arial, sans-serif; }
        .subtitle { fill: #cbd5e1; font: 400 22px Arial, sans-serif; }
      </style>
      <text x="0" y="48" class="title">${title}</text>
      <text x="0" y="88" class="subtitle">${subtitle}</text>
    </svg>
  `);
}
