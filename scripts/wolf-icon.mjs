import { mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const html = `<!doctype html>
<meta charset="utf-8" />
<canvas id="c" width="512" height="512"></canvas>
<script>
const ctx = document.getElementById('c').getContext('2d');
ctx.fillStyle = '#146b32';
ctx.fillRect(0, 0, 512, 512);
ctx.save();
ctx.translate(220, 300);
ctx.scale(4.6, 4.6);
ctx.lineJoin = 'round';
ctx.lineCap = 'round';
ctx.strokeStyle = '#111';
ctx.lineWidth = 1.4;
ctx.fillStyle = '#1a1a1a';
ctx.beginPath();
ctx.moveTo(-16, -8);
ctx.quadraticCurveTo(-28, -18, -24, -4);
ctx.quadraticCurveTo(-20, 2, -12, -2);
ctx.fill();
ctx.beginPath();
ctx.ellipse(-4, -16, 11, 14, -0.2, 0, Math.PI * 2);
ctx.fill();
ctx.stroke();
ctx.fillStyle = '#1a1a1a';
ctx.beginPath();
ctx.moveTo(-8, -4);
ctx.lineTo(-12, 16);
ctx.lineTo(-4, 16);
ctx.lineTo(-2, -2);
ctx.closePath();
ctx.fill();
ctx.stroke();
ctx.beginPath();
ctx.moveTo(2, -2);
ctx.lineTo(0, 16);
ctx.lineTo(8, 16);
ctx.lineTo(8, -4);
ctx.closePath();
ctx.fill();
ctx.stroke();
ctx.fillStyle = '#1a1a1a';
ctx.beginPath();
ctx.ellipse(6, -30, 10, 9, 0.15, 0, Math.PI * 2);
ctx.fill();
ctx.stroke();
ctx.beginPath();
ctx.ellipse(14, -28, 8, 5, 0.2, 0, Math.PI * 2);
ctx.fill();
ctx.stroke();
ctx.beginPath();
ctx.moveTo(-2, -36);
ctx.lineTo(-6, -52);
ctx.lineTo(2, -36);
ctx.closePath();
ctx.fill();
ctx.stroke();
ctx.beginPath();
ctx.moveTo(4, -37);
ctx.lineTo(6, -54);
ctx.lineTo(11, -36);
ctx.closePath();
ctx.fill();
ctx.stroke();
ctx.fillStyle = '#f4f1ea';
ctx.beginPath();
ctx.ellipse(16, -29, 7, 4.5, 0.15, 0, Math.PI * 2);
ctx.fill();
ctx.stroke();
ctx.fillStyle = '#fff';
ctx.beginPath();
ctx.arc(12, -32, 2.3, 0, Math.PI * 2);
ctx.fill();
ctx.fillStyle = '#111';
ctx.beginPath();
ctx.arc(12.7, -32, 1, 0, Math.PI * 2);
ctx.fill();
ctx.strokeStyle = '#111';
ctx.lineWidth = 3.2;
ctx.beginPath();
ctx.moveTo(2, -12);
ctx.quadraticCurveTo(10, -18, 16, -4);
ctx.stroke();
ctx.fillStyle = '#e07a2f';
ctx.lineWidth = 1.5;
ctx.beginPath();
ctx.roundRect(8, -8, 20, 12, 3);
ctx.fill();
ctx.stroke();
ctx.beginPath();
ctx.arc(18, -8, 8, Math.PI, 0);
ctx.stroke();
ctx.fillStyle = '#fff6dc';
ctx.beginPath();
ctx.ellipse(16, -3, 4, 5, 0, 0, Math.PI * 2);
ctx.fill();
ctx.restore();
</script>`;

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || '/usr/local/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage();
await page.setViewport({ width: 512, height: 512, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: 'networkidle0' });
mkdirSync('public/icons', { recursive: true });
const source = 'public/icons/icon-512.png';
await page.screenshot({ path: source, clip: { x: 0, y: 0, width: 512, height: 512 } });
await browser.close();

const sizes = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
for (const [bucket, size] of Object.entries(sizes)) {
  for (const name of ['ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png']) {
    const target = `android/app/src/main/res/mipmap-${bucket}/${name}`;
    const result = spawnSync('ffmpeg', ['-y', '-i', source, '-vf', `scale=${size}:${size}`, '-update', '1', target], {
      stdio: 'ignore',
    });
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
}
spawnSync('ffmpeg', ['-y', '-i', source, '-vf', 'scale=192:192', '-update', '1', 'public/icons/icon-192.png'], {
  stdio: 'ignore',
});
spawnSync('ffmpeg', ['-y', '-i', source, '-vf', 'scale=32:32', '-update', '1', 'public/icons/favicon.png'], {
  stdio: 'ignore',
});
spawnSync('cp', [source, 'public/icons/icon-maskable-512.png']);
console.log('wolf icon written');
