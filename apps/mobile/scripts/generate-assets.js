#!/usr/bin/env node
// Generates VitalCV Wallet placeholder assets for EAS build.
// Pure Node.js — no dependencies. Creates minimal valid PNGs with the brand
// background (#080e1a) and a centered "V" letterform in trust-green (#22c55e).

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createPNG(width, height, drawFn) {
  const channels = 4; // RGBA
  const raw = Buffer.alloc(height * (1 + width * channels));

  // Fill background #080e1a
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * channels);
    raw[rowStart] = 0; // filter byte
    for (let x = 0; x < width; x++) {
      const offset = rowStart + 1 + x * channels;
      raw[offset] = 0x08;     // R
      raw[offset + 1] = 0x0e; // G
      raw[offset + 2] = 0x1a; // B
      raw[offset + 3] = 0xff; // A
    }
  }

  if (drawFn) drawFn(raw, width, height, channels);

  const deflated = zlib.deflateSync(raw, { level: 9 });

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typeB = Buffer.from(type, 'ascii');
    const crcData = Buffer.concat([typeB, data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(crcData) >>> 0);
    return Buffer.concat([len, typeB, data, crc]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  const iend = Buffer.alloc(0);

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflated),
    chunk('IEND', iend),
  ]);
}

// CRC-32 (PNG spec)
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  crcTable[n] = c;
}
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff);
}

function setPixel(raw, width, channels, x, y, r, g, b, a) {
  if (x < 0 || x >= width) return;
  const rowLen = 1 + width * channels;
  const offset = y * rowLen + 1 + x * channels;
  raw[offset] = r;
  raw[offset + 1] = g;
  raw[offset + 2] = b;
  raw[offset + 3] = a;
}

function fillRect(raw, width, channels, x0, y0, w, h, r, g, b, a) {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      setPixel(raw, width, channels, x0 + dx, y0 + dy, r, g, b, a);
    }
  }
}

function drawV(raw, width, height, channels) {
  // Draw a bold "V" letterform centered in the image
  // Trust green: #22c55e
  const r = 0x22, g = 0xc5, b = 0x5e, a = 0xff;

  const size = Math.min(width, height);
  const scale = size / 1024;
  const cx = Math.floor(width / 2);
  const cy = Math.floor(height / 2);

  // V shape: two diagonal strokes meeting at bottom center
  const strokeW = Math.max(Math.floor(60 * scale), 4);
  const vTop = Math.floor(cy - 200 * scale);
  const vBot = Math.floor(cy + 200 * scale);
  const vSpread = Math.floor(180 * scale);
  const totalH = vBot - vTop;

  for (let row = 0; row < totalH; row++) {
    const t = row / totalH;
    const leftCenter = cx - vSpread + Math.floor(vSpread * t);
    const rightCenter = cx + vSpread - Math.floor(vSpread * t);
    const hw = Math.floor(strokeW / 2 * (1 - t * 0.3));

    fillRect(raw, width, channels,
      leftCenter - hw, vTop + row,
      hw * 2, 1, r, g, b, a);

    if (t < 0.85) {
      fillRect(raw, width, channels,
        rightCenter - hw, vTop + row,
        hw * 2, 1, r, g, b, a);
    }
  }

  // Small accent circle under the V
  const dotR = Math.max(Math.floor(16 * scale), 2);
  const dotCy = vBot + Math.floor(40 * scale);
  for (let dy = -dotR; dy <= dotR; dy++) {
    for (let dx = -dotR; dx <= dotR; dx++) {
      if (dx * dx + dy * dy <= dotR * dotR) {
        setPixel(raw, width, channels, cx + dx, dotCy + dy, r, g, b, a);
      }
    }
  }
}

const outDir = path.join(__dirname, '..', 'assets');
fs.mkdirSync(outDir, { recursive: true });

// 1. App icon (1024×1024)
const icon = createPNG(1024, 1024, drawV);
fs.writeFileSync(path.join(outDir, 'icon.png'), icon);

// 2. Splash (1284×2778 — iPhone 6.5")
const splash = createPNG(1284, 2778, drawV);
fs.writeFileSync(path.join(outDir, 'splash.png'), splash);

// 3. Adaptive icon foreground (1024×1024, same as icon)
fs.writeFileSync(path.join(outDir, 'adaptive-icon.png'), icon);

// 4. Favicon for Expo web (48×48)
const favicon = createPNG(48, 48, drawV);
fs.writeFileSync(path.join(outDir, 'favicon.png'), favicon);

console.log('Generated:');
console.log('  assets/icon.png          (1024×1024)');
console.log('  assets/splash.png        (1284×2778)');
console.log('  assets/adaptive-icon.png (1024×1024)');
console.log('  assets/favicon.png       (48×48)');
