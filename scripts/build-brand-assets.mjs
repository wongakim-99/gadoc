import { readFile, writeFile, copyFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const at = (file) => path.join(root, file);
const source = at("packages/web/public/brand/gadoc-mark.svg");
const mark = await readFile(source);

// Generate every app icon from the same vector, including legacy asset URLs.
for (const file of [
  "packages/web/public/logo.svg",
  "packages/web/public/logo-workspace.svg",
  "packages/web/app/icon.svg",
  "packages/web/public/assets/slacord-logo.svg",
]) {
  await copyFile(source, at(file));
}
for (const [file, size] of [
  ["packages/web/public/brand/gadoc-icon.png", 512],
  ["packages/web/public/brand/gadoc-apple.png", 180],
  ["packages/web/public/assets/slacord-bot-icon.png", 512],
  ["packages/desktop/build/icon.png", 1024],
]) {
  await sharp(mark, { density: 1200 })
    .resize(size, size)
    .png()
    .toFile(at(file));
}
await sharp(mark, { density: 1200 })
  .resize(512, 512)
  .flatten({ background: "#181b20" })
  .jpeg()
  .toFile(at("packages/web/public/assets/slacord-logo.jpeg"));

const chunks = [];
for (const [type, size] of [
  ["ic08", 256],
  ["ic09", 512],
  ["ic10", 1024],
]) {
  const png = await sharp(mark, { density: 1200 })
    .resize(size, size)
    .png()
    .toBuffer();
  const header = Buffer.alloc(8);
  header.write(type);
  header.writeUInt32BE(png.length + 8, 4);
  chunks.push(header, png);
}
const icns = Buffer.alloc(8);
icns.write("icns");
icns.writeUInt32BE(8 + chunks.reduce((sum, chunk) => sum + chunk.length, 0), 4);
await writeFile(
  at("packages/desktop/build/icon.icns"),
  Buffer.concat([icns, ...chunks]),
);

const png = await sharp(mark, { density: 1200 })
  .resize(256, 256)
  .png()
  .toBuffer();
const ico = Buffer.alloc(22);
ico.writeUInt16LE(1, 2);
ico.writeUInt16LE(1, 4);
ico.writeUInt16LE(1, 10);
ico.writeUInt16LE(32, 12);
ico.writeUInt32LE(png.length, 14);
ico.writeUInt32LE(22, 18);
await writeFile(
  at("packages/desktop/build/icon.ico"),
  Buffer.concat([ico, png]),
);

const social =
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="#181b20"/>
<path d="M750 100H820C970 100 870 315 1050 315H1200M750 530H820C970 530 870 315 1050 315H1200" stroke="#657DA8" stroke-width="3" fill="none"/>
<path d="M750 315H1200" stroke="#A8BDFF" stroke-width="3"/>
<text x="88" y="290" font-family="sans-serif" font-size="112" font-weight="700" fill="#EDF0F5">Ga<tspan fill="#A8BDFF" font-weight="400">Doc</tspan></text>
<text x="94" y="365" font-family="sans-serif" font-size="28" fill="#BDC5D2">Where work comes together.</text>
<path d="M94 470H642" stroke="#343C49"/>
<text x="94" y="510" font-family="sans-serif" font-size="17" fill="#9AA6B8">Conversations. Documents. Work, connected.</text>
</svg>`);
await sharp(social)
  .png()
  .toFile(at("packages/web/public/brand/gadoc-social.png"));
console.log("GaDoc web, social and desktop icons generated.");
