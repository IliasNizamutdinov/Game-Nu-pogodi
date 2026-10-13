import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(root, { recursive: true });

function crc32(buffer) {
  let crc = ~0;
  for (let i = 0; i < buffer.length; i += 1) {
    crc ^= buffer[i];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

function png(width, height, pixels) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const start = y * (width * 4 + 1);
    raw[start] = 0;
    pixels.copy(raw, start + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function create(size, inset) {
  const pixels = Buffer.alloc(size * size * 4);
  const set = (x, y, r, g, b, a = 255) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    const src = a / 255;
    const dst = pixels[i + 3] / 255;
    const out = src + dst * (1 - src);
    if (out <= 0) return;
    pixels[i] = Math.round((r * src + pixels[i] * dst * (1 - src)) / out);
    pixels[i + 1] = Math.round((g * src + pixels[i + 1] * dst * (1 - src)) / out);
    pixels[i + 2] = Math.round((b * src + pixels[i + 2] * dst * (1 - src)) / out);
    pixels[i + 3] = Math.round(out * 255);
  };
  const fillCircle = (cx, cy, radius, color) => {
    const r2 = radius * radius;
    for (let y = Math.floor(cy - radius); y <= cy + radius; y += 1) {
      for (let x = Math.floor(cx - radius); x <= cx + radius; x += 1) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        if (dx * dx + dy * dy <= r2) set(x, y, color[0], color[1], color[2], color[3] ?? 255);
      }
    }
  };
  const fillEllipse = (cx, cy, rx, ry, color) => {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y += 1) {
      for (let x = Math.floor(cx - rx); x <= cx + rx; x += 1) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) set(x, y, color[0], color[1], color[2], color[3] ?? 255);
      }
    }
  };

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const t = y / size;
      const r = Math.round(92 + t * 40);
      const g = Math.round(32 + t * 10);
      const b = Math.round(24 + t * 8);
      set(x, y, r, g, b);
    }
  }

  const cx = size / 2;
  const cy = size / 2 + size * 0.02;
  fillCircle(cx, cy - size * 0.16, size * 0.16, [112, 108, 118]);
  fillEllipse(cx - size * 0.1, cy - size * 0.3, size * 0.045, size * 0.11, [112, 108, 118]);
  fillEllipse(cx + size * 0.08, cy - size * 0.3, size * 0.045, size * 0.11, [112, 108, 118]);
  fillEllipse(cx + size * 0.06, cy - size * 0.14, size * 0.09, size * 0.07, [239, 232, 220]);
  fillCircle(cx + size * 0.09, cy - size * 0.15, size * 0.018, [36, 28, 24]);
  fillEllipse(cx, cy + size * 0.08, size * 0.2, size * 0.16, [110, 106, 116]);
  fillEllipse(cx + size * 0.02, cy + size * 0.22, size * 0.16, size * 0.07, [216, 97, 42]);
  fillEllipse(cx - size * 0.22, cy + size * 0.02, size * 0.11, size * 0.15, [255, 246, 220]);
  fillEllipse(cx - size * 0.26, cy - size * 0.02, size * 0.035, size * 0.055, [255, 255, 255]);

  if (inset > 0) {
    const margin = Math.floor(size * inset);
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        if (x < margin || y < margin || x >= size - margin || y >= size - margin) {
          const i = (y * size + x) * 4;
          pixels[i] = 74;
          pixels[i + 1] = 28;
          pixels[i + 2] = 20;
          pixels[i + 3] = 255;
        }
      }
    }
  }

  return png(size, size, pixels);
}

writeFileSync(join(root, 'favicon.png'), create(32, 0));
writeFileSync(join(root, 'icon-192.png'), create(192, 0));
writeFileSync(join(root, 'icon-512.png'), create(512, 0));
writeFileSync(join(root, 'icon-maskable-512.png'), create(512, 0.12));
console.log('icons written to public/icons');
