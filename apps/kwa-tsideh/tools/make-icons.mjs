/**
 * Generates every app icon from code. No design tool, no binary source of
 * truth: change a number here and run `node tools/make-icons.mjs`.
 *
 * The mark is the product -- six sources converging on one center.
 *
 * Rendered at 4x and downsampled for antialiasing, then written as PNG with
 * Node's built-in zlib. No dependencies by design.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets');

const BG = [0x0b, 0x0b, 0x0c];
const GOLD = [0xe8, 0xb1, 0x4c];
const SPOKE = [0x8a, 0x69, 0x2c];

const SS = 4; // supersample factor

// ---------- PNG ----------

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** rgba: Uint8ClampedArray of size*size*4 */
function encodePng(rgba, size) {
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    Buffer.from(rgba.buffer, y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- drawing ----------

function makeCanvas(size, bg) {
  const px = new Uint8ClampedArray(size * size * 4);
  if (bg) {
    for (let i = 0; i < size * size; i++) {
      px[i * 4] = bg[0];
      px[i * 4 + 1] = bg[1];
      px[i * 4 + 2] = bg[2];
      px[i * 4 + 3] = 255;
    }
  }
  return px;
}

function plot(px, size, x, y, color) {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  const i = (y * size + x) * 4;
  px[i] = color[0];
  px[i + 1] = color[1];
  px[i + 2] = color[2];
  px[i + 3] = 255;
}

function disc(px, size, cx, cy, r, color) {
  const r2 = r * r;
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) plot(px, size, x, y, color);
    }
  }
}

function line(px, size, x0, y0, x1, y1, width, color) {
  const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    disc(px, size, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, width / 2, color);
  }
}

/** Six satellites, six spokes, one center. */
function drawMark(px, size, scale) {
  const c = size / 2;
  const orbit = 0.3 * size * scale;
  const satellite = 0.052 * size * scale;
  const core = 0.105 * size * scale;
  const spoke = 0.018 * size * scale;

  const points = Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    return [c + Math.cos(angle) * orbit, c + Math.sin(angle) * orbit];
  });

  for (const [x, y] of points) line(px, size, c, c, x, y, spoke, SPOKE);
  for (const [x, y] of points) disc(px, size, x, y, satellite, GOLD);
  disc(px, size, c, c, core, GOLD);
}

function downsample(src, size, factor) {
  const out = size / factor;
  const px = new Uint8ClampedArray(out * out * 4);
  for (let y = 0; y < out; y++) {
    for (let x = 0; x < out; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let dy = 0; dy < factor; dy++) {
        for (let dx = 0; dx < factor; dx++) {
          const i = ((y * factor + dy) * size + (x * factor + dx)) * 4;
          r += src[i];
          g += src[i + 1];
          b += src[i + 2];
          a += src[i + 3];
        }
      }
      const n = factor * factor;
      const i = (y * out + x) * 4;
      px[i] = r / n;
      px[i + 1] = g / n;
      px[i + 2] = b / n;
      px[i + 3] = a / n;
    }
  }
  return px;
}

function render({ size, background, scale }) {
  const big = size * SS;
  const px = makeCanvas(big, background);
  drawMark(px, big, scale);
  return encodePng(downsample(px, big, SS), size);
}

const targets = [
  // Store icon: opaque, mark fills the tile.
  { file: 'icon.png', size: 1024, background: BG, scale: 1 },
  // Android adaptive foreground: transparent, mark inside the 66% safe zone
  // so the launcher's mask cannot clip it.
  { file: 'adaptive-icon.png', size: 1024, background: null, scale: 0.62 },
  { file: 'splash-icon.png', size: 1024, background: null, scale: 0.72 },
  { file: 'favicon.png', size: 96, background: BG, scale: 1 },
];

for (const t of targets) {
  writeFileSync(join(OUT, t.file), render(t));
  console.log(`wrote assets/${t.file} (${t.size}px)`);
}
