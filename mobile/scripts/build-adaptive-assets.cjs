/**
 * Pads the logo into a 1024×1024 canvas with ~66% inner safe zone (Android adaptive icon).
 * Reads assets/icon.png once; writes adaptive-icon.png, icon.png, and splash.png.
 */
const fs = require("fs/promises");
const path = require("path");
const sharp = require("sharp");

const ASSETS = path.join(__dirname, "..", "assets");
const SOURCE = path.join(ASSETS, "icon.png");
const CANVAS = 1024;
/** Inner box ~66% of canvas — Material adaptive icon safe zone */
const INNER_MAX = 672;
const BG = { r: 255, g: 255, b: 255, alpha: 1 };

async function buildPaddedPng(inputBuffer) {
  const img = sharp(inputBuffer);
  const meta = await img.metadata();
  const w = meta.width || INNER_MAX;
  const h = meta.height || INNER_MAX;
  const scale = Math.min(INNER_MAX / w, INNER_MAX / h);
  const nw = Math.max(1, Math.round(w * scale));
  const nh = Math.max(1, Math.round(h * scale));
  const resized = await img.resize(nw, nh).png().toBuffer();
  const left = Math.round((CANVAS - nw) / 2);
  const top = Math.round((CANVAS - nh) / 2);
  return sharp({
    create: { width: CANVAS, height: CANVAS, channels: 4, background: BG },
  })
    .composite([{ input: resized, left, top }])
    .png()
    .toBuffer();
}

async function main() {
  const inputBuffer = await fs.readFile(SOURCE);
  const out = await buildPaddedPng(inputBuffer);
  const targets = ["adaptive-icon.png", "icon.png", "splash.png"];
  for (const name of targets) {
    const dest = path.join(ASSETS, name);
    await fs.writeFile(dest, out);
    console.log("Wrote", dest);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
