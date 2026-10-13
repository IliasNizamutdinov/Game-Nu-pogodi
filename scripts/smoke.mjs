import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import puppeteer from 'puppeteer-core';

const URL = 'http://127.0.0.1:4173/Game-Nu-pogodi/';
const CHROME = process.env.CHROME_PATH || '/usr/local/bin/google-chrome';

function buttonCenter(id) {
  const controls = {
    pause: { x: 8, y: 528, w: 110, h: 36 },
    gameA: { x: 178, y: 572, w: 174, h: 66 },
    gameB: { x: 178, y: 646, w: 174, h: 66 },
    ul: { x: 8, y: 572, w: 78, h: 66 },
  };
  const rect = controls[id];
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
}

async function tapLogical(page, id) {
  const point = buttonCenter(id);
  const target = await page.evaluate(({ x, y }) => {
    const canvas = document.querySelector('canvas');
    const rect = canvas.getBoundingClientRect();
    return {
      x: rect.left + (x / 360) * rect.width,
      y: rect.top + (y / 740) * rect.height,
    };
  }, point);
  await page.touchscreen.tap(target.x, target.y);
}

async function pixelHash(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    let hash = 2166136261;
    for (let i = 0; i < data.length; i += 32) {
      hash ^= data[i];
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  });
}

const server = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', '4173', '--strictPort'], {
  stdio: ['ignore', 'pipe', 'pipe'],
  detached: true,
});

let serverLog = '';
server.stdout.on('data', (chunk) => {
  serverLog += chunk.toString();
});
server.stderr.on('data', (chunk) => {
  serverLog += chunk.toString();
});

async function stopServer() {
  if (server.pid) {
    try {
      process.kill(-server.pid, 'SIGTERM');
    } catch {
      server.kill('SIGTERM');
    }
  }
  server.stdout.destroy();
  server.stderr.destroy();
  await delay(200);
}

try {
  let ready = false;
  for (let i = 0; i < 40; i += 1) {
    try {
      const response = await fetch(URL);
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {
      // Preview is still booting.
    }
    await delay(250);
  }
  if (!ready) throw new Error(`preview did not start\n${serverLog}`);

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('requestfailed', (request) => {
      const failure = request.failure();
      errors.push(`request failed ${request.url()} ${failure?.errorText ?? ''}`);
    });

    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await page.goto(URL, { waitUntil: 'networkidle0' });
    await page.waitForSelector('canvas');

    const menuA = await pixelHash(page);
    await delay(350);
    const menuB = await pixelHash(page);
    if (menuA !== menuB) throw new Error('menu frame changed while the game was idle');

    await tapLogical(page, 'gameA');
    await delay(700);
    const playing = await pixelHash(page);
    if (playing === menuA) throw new Error('the board did not change after Game A');

    await tapLogical(page, 'ul');
    await tapLogical(page, 'pause');
    await delay(80);
    const pausedA = await pixelHash(page);
    await delay(450);
    const pausedB = await pixelHash(page);
    if (pausedA !== pausedB) throw new Error('pause did not freeze the canvas');

    await page.setViewport({ width: 844, height: 390, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    await delay(200);
    const box = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      const rect = canvas.getBoundingClientRect();
      return {
        width: rect.width,
        height: rect.height,
        left: rect.left,
        top: rect.top,
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
      };
    });
    if (box.width < 40 || box.height < 40) throw new Error(`canvas collapsed in landscape: ${JSON.stringify(box)}`);
    if (box.left < -1 || box.top < -1) throw new Error(`canvas left the viewport: ${JSON.stringify(box)}`);
    if (box.left + box.width > box.innerWidth + 2 || box.top + box.height > box.innerHeight + 2) {
      throw new Error(`canvas overflowed the landscape viewport: ${JSON.stringify(box)}`);
    }

    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await delay(150);
    await tapLogical(page, 'gameB');
    await delay(400);

    const swReady = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false;
      const registration = await navigator.serviceWorker.ready;
      return Boolean(registration.active);
    });
    if (!swReady) throw new Error('service worker did not activate');

    await page.setOfflineMode(true);
    const offlineResponse = await page.reload({ waitUntil: 'domcontentloaded' });
    if (!offlineResponse || !offlineResponse.ok()) {
      throw new Error(`offline reload failed: ${offlineResponse?.status()}`);
    }
    await page.waitForSelector('canvas');
    const offlineBox = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      return canvas ? canvas.width > 0 && canvas.height > 0 : false;
    });
    if (!offlineBox) throw new Error('canvas missing after offline reload');

    const meaningful = errors.filter(
      (line) => !line.includes('favicon') && !line.includes('net::ERR_INTERNET_DISCONNECTED') && line.trim() !== '',
    );
    if (meaningful.length > 0) {
      throw new Error(`browser errors:\n${meaningful.join('\n')}`);
    }
    console.log('smoke passed');
  } finally {
    await browser.close();
  }
} finally {
  await stopServer();
}
