import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = join(process.cwd(), 'dist-phone');
const assetsDir = join(dist, 'assets');
const names = readdirSync(assetsDir);
const jsName = names.find((name) => name.endsWith('.js'));
const cssName = names.find((name) => name.endsWith('.css'));
if (!jsName || !cssName) {
  console.error('dist-phone/assets is missing the built script or stylesheet. Run npm run phone.');
  process.exit(1);
}

const script = readFileSync(join(assetsDir, jsName), 'utf8').replaceAll('</script>', '<\\/script>');
const style = readFileSync(join(assetsDir, cssName), 'utf8');

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
    />
    <meta name="theme-color" content="#146b32" />
    <title>Wolf Catches Eggs</title>
    <style>
${style}
    </style>
  </head>
  <body>
    <div id="safe-area-probe" aria-hidden="true"></div>
    <canvas id="game" aria-label="Wolf Catches Eggs"></canvas>
    <script type="module">
${script}
    </script>
  </body>
</html>
`;

mkdirSync(join(process.cwd(), 'release'), { recursive: true });
const out = join(process.cwd(), 'release', 'wolf-catches-eggs.html');
writeFileSync(out, html);
console.log(`phone file: ${out} (${html.length} bytes)`);
