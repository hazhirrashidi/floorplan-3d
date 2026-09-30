/* Syncs the web app (public/floorplan.html + public/vendor) into desktop/app,
 * which is what Electron loads and what electron-builder packages.
 * public/ stays the single source of truth for the app code.
 */
import { cpSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const desktop = join(here, '..');
const src = join(desktop, '..', 'public');
const out = join(desktop, 'app');

mkdirSync(out, { recursive: true });
cpSync(join(src, 'floorplan.html'), join(out, 'index.html'));
if (existsSync(join(src, 'vendor'))){
  cpSync(join(src, 'vendor'), join(out, 'vendor'), { recursive: true });
} else {
  console.error('[sync] WARNING: public/vendor is missing — run the vendor step first!');
  process.exit(1);
}
console.log('[sync] copied floorplan.html -> app/index.html (+ vendor)');
