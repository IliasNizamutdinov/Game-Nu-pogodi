import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const dist = join(process.cwd(), 'dist');
const failures = [];

function fail(message) {
  failures.push(message);
}

if (!existsSync(dist)) fail('dist/ is missing. Run npm run build first.');

const names = existsSync(dist) ? readdirSync(dist) : [];
if (!names.includes('index.html')) fail('dist/index.html is missing');
if (!names.includes('manifest.webmanifest')) fail('dist/manifest.webmanifest is missing');
if (!names.some((name) => name === 'sw.js' || name.startsWith('workbox-'))) {
  fail(`service worker is missing in dist (${names.join(', ')})`);
}

for (const icon of ['icons/favicon.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png']) {
  const path = join(dist, icon);
  if (!existsSync(path) || statSync(path).size < 32) fail(`${icon} is missing from dist`);
}

if (existsSync(join(dist, 'index.html'))) {
  const html = readFileSync(join(dist, 'index.html'), 'utf8');
  if (!html.includes('/Game-Nu-pogodi/')) fail('index.html is not built for /Game-Nu-pogodi/');
  if (html.includes('fonts.googleapis') || html.includes('cdn.jsdelivr')) {
    fail('index.html depends on an external CDN');
  }
}

const swName = names.find((name) => name === 'sw.js');
if (swName) {
  const sw = readFileSync(join(dist, swName), 'utf8');
  if (!sw.includes('index.html')) fail('service worker does not precache index.html');
  if (sw.includes('fonts.googleapis')) fail('service worker references a remote font');
}

if (existsSync(join(dist, 'manifest.webmanifest'))) {
  const manifest = JSON.parse(readFileSync(join(dist, 'manifest.webmanifest'), 'utf8'));
  if (!String(manifest.start_url).includes('Game-Nu-pogodi') && manifest.start_url !== './') {
    fail(`unexpected start_url: ${manifest.start_url}`);
  }
  if (!manifest.icons?.length) fail('manifest has no icons');
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('dist is ready for GitHub Pages at /Game-Nu-pogodi/');
