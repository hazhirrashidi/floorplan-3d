/* Pre-seeds the electron-builder winCodeSign cache WITHOUT creating symlinks.
 *
 * Why: the official winCodeSign-2.6.0.7z archive contains two macOS symlinks
 * (darwin/10.12/lib/libcrypto.dylib, libssl.dylib). Extracting symlinks on
 * Windows requires Developer Mode or an elevated shell, so a normal build
 * fails with "Cannot create symbolic link : A required privilege is not held
 * by the client." — see electron-builder issue reports.
 *
 * This script downloads the same archive and extracts it while ignoring those
 * two symlink entries (they are only needed for macOS code signing, never for
 * building/running Windows targets), then places the result exactly where
 * electron-builder expects it:
 *   Windows:  %LOCALAPPDATA%\electron-builder\Cache\winCodeSign\winCodeSign-2.6.0
 *   Linux:    ~/.cache/electron-builder/winCodeSign/winCodeSign-2.6.0
 *   macOS:    ~/Library/Caches/electron-builder/winCodeSign/winCodeSign-2.6.0
 *
 * When the cache is already populated, electron-builder skips its own
 * download+extract entirely and the build proceeds normally.
 *
 * This script never fails the build — on any error it warns and exits 0 so
 * electron-builder can fall back to its own (possibly failing) path, which the
 * bat file then handles.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, platform, tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION = '2.6.0';
const MARKER = 'rcedit-x64.exe';
const DEFAULT_URL = `https://github.com/electron-userland/electron-builder-binaries/releases/download/winCodeSign-${VERSION}/winCodeSign-${VERSION}.7z`;

const here = path.dirname(fileURLToPath(import.meta.url));
const desktop = path.join(here, '..');

function cacheRoot(){
  if (process.env.ELECTRON_BUILDER_CACHE) return process.env.ELECTRON_BUILDER_CACHE;
  const p = platform();
  if (p === 'win32'){
    const lad = process.env.LOCALAPPDATA || path.join(homedir(), 'AppData', 'Local');
    return path.join(lad, 'electron-builder', 'Cache');
  }
  if (p === 'darwin') return path.join(homedir(), 'Library', 'Caches', 'electron-builder');
  return path.join(process.env.XDG_CACHE_HOME || path.join(homedir(), '.cache'), 'electron-builder');
}

function sevenZipBin(){
  const p = platform();
  const sub = p === 'win32' ? path.join('win', 'x64', '7za.exe')
    : p === 'darwin' ? path.join('mac', 'x64', '7za')       // 7zip-bin uses "mac"
    : path.join('linux', 'x64', '7za');
  return path.join(desktop, 'node_modules', '7zip-bin', sub);
}

function mirrorUrl(){
  const m = process.env.ELECTRON_BUILDER_BINARIES_MIRROR
    || process.env.NPM_CONFIG_ELECTRON_BUILDER_BINARIES_MIRROR
    || process.env.npm_config_electron_builder_binaries_mirror;
  return m ? `${m.replace(/\/+$/, '')}/winCodeSign-${VERSION}/winCodeSign-${VERSION}.7z` : DEFAULT_URL;
}

async function downloadTo(url, dest){
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1000) throw new Error('Downloaded file is too small — likely a proxy error page');
  writeFileSync(dest, buf);
  return buf.length;
}

async function main(){
  const root = cacheRoot();
  const pkgDir = path.join(root, 'winCodeSign');
  const finalDir = path.join(pkgDir, `winCodeSign-${VERSION}`);
  const markerPath = path.join(finalDir, MARKER);

  if (existsSync(markerPath)){
    console.log(`[winCodeSign] cache OK: ${finalDir}`);
    return;
  }

  if (typeof fetch !== 'function'){
    console.warn('[winCodeSign] Node 18+ required for the cache pre-seed — skipping (build may fall back)');
    return;
  }

  console.log(`[winCodeSign] seeding cache at ${finalDir} (avoids the Windows symlink-privilege build failure) ...`);
  mkdirSync(pkgDir, { recursive: true });

  const tmpBase = path.join(pkgDir, `fp-seed-${Date.now()}`);
  const archive = tmpBase + '.7z';
  const extractDir = tmpBase + '-x';
  try {
    const size = await downloadTo(mirrorUrl(), archive);
    console.log(`[winCodeSign] downloaded ${(size / 1024 / 1024).toFixed(1)} MB`);

    const sevenZip = sevenZipBin();
    if (!existsSync(sevenZip)) throw new Error('7za not found — run npm install in desktop/ first');
    // NOTE: we deliberately ignore the exit code. On Windows, extracting the two
    // macOS symlink entries fails without Developer Mode (exit code 2) — that is
    // expected and harmless; everything needed for Windows builds still extracts.
    try {
      execFileSync(sevenZip, ['x', '-y', '-bd', archive, `-o${extractDir}`], { stdio: ['ignore', 'ignore', 'ignore'] });
    } catch { /* exit code 2 = symlink sub-items; handled below */ }

    if (!existsSync(path.join(extractDir, MARKER))) throw new Error(`extraction did not produce ${MARKER}`);

    rmSync(finalDir, { recursive: true, force: true });
    renameSync(extractDir, finalDir);
    console.log('[winCodeSign] cache seeded successfully — electron-builder will use it as-is');
  } catch (err) {
    console.warn(`[winCodeSign] pre-seed failed (${err.message}) — continuing anyway`);
  } finally {
    for (const p of [archive, extractDir]){
      try { rmSync(p, { recursive: true, force: true }); } catch {}
    }
  }
}

main().then(() => process.exit(0), () => process.exit(0));
