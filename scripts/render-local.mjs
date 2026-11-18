/**
 * Рендер без интернета и без системного Chrome.
 *
 * Remotion обычно скачивает свой headless-браузер, а в закрытых песочницах
 * (и на тонких CI-образах) это невозможно. Здесь мы берём Chromium из
 * @sparticuz/chromium и докладываем ему недостающие библиотеки NSS/NSPR
 * из того же пакета.
 *
 *   node scripts/render-local.mjs                 # → out/pisa-ru.mp4
 *   node scripts/render-local.mjs still 300       # → out/frame-300.png
 *   node scripts/render-local.mjs render out/x.mp4
 */
import { spawn } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBrotliDecompress } from 'node:zlib';
import { extract } from 'tar-fs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const libRoot = join(root, '.cache', 'chromium-libs');
const libDir = join(libRoot, 'lib'); // в архиве AL2023 библиотеки лежат в lib/
const libArchive = join(root, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br');

const unpackLibs = async () => {
  mkdirSync(libRoot, { recursive: true });
  if (existsSync(join(libDir, 'libnss3.so'))) return;
  await new Promise((resolve, reject) => {
    createReadStream(libArchive)
      .pipe(createBrotliDecompress())
      .pipe(extract(libRoot))
      .on('finish', resolve)
      .on('error', reject);
  });
};

const findChrome = async () => {
  // 1) Chromium из @sparticuz/chromium (распаковывается в /tmp)
  try {
    const { default: chromium } = await import('@sparticuz/chromium');
    const path = await chromium.executablePath();
    if (path && existsSync(path)) return { path, libs: true };
  } catch {
    /* пакета нет — пробуем системный браузер */
  }
  // 2) системный Chrome/Chromium, если он есть
  for (const p of [
    process.env.REMOTION_BROWSER_EXECUTABLE,
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ]) {
    if (p && existsSync(p)) return { path: p, libs: false };
  }
  throw new Error('Не найден браузер: установите Chrome или @sparticuz/chromium');
};

const chrome = await findChrome();
const env = { ...process.env, REMOTION_BROWSER_EXECUTABLE: chrome.path };
if (chrome.libs && existsSync(libArchive)) {
  await unpackLibs();
  env.LD_LIBRARY_PATH = [libDir, process.env.LD_LIBRARY_PATH].filter(Boolean).join(':');
}

const [, , cmd = 'render', arg1, arg2] = process.argv;
const outDir = join(root, 'out');
mkdirSync(outDir, { recursive: true });

let args;
if (cmd === 'still') {
  const frame = arg1 ?? '0';
  args = ['remotion', 'still', 'PisaRu', arg2 ?? join(outDir, `frame-${frame}.png`), `--frame=${frame}`];
} else {
  args = ['remotion', 'render', 'PisaRu', arg1 ?? join(outDir, 'pisa-ru.mp4'), ...(arg2 ? [arg2] : [])];
}

console.log(`→ ${args.join(' ')}`);
const child = spawn('npx', args, { cwd: root, env, stdio: 'inherit' });
child.on('exit', (code) => process.exit(code ?? 0));
