/* Cross-platform smoke test runner: launches Electron with FP_SMOKE=1 and
 * prints the SMOKE_RESULT line emitted by the main process. Exits non-zero on failure.
 * Works on Windows (cmd) too, unlike `FOO=1 electron .`.
 */
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const desktop = join(here, '..');

const env = { ...process.env, FP_SMOKE: '1' };
const bin = join(desktop, 'node_modules', '.bin', process.platform === 'win32' ? 'electron.cmd' : 'electron');
const child = spawn(bin, ['.'], { cwd: desktop, env, stdio: ['ignore', 'pipe', 'inherit'] });

let out = '';
child.stdout.on('data', d => {
  out += d.toString();
  process.stdout.write(d);
});
child.on('exit', code => {
  if (!/SMOKE_RESULT /.test(out) || /"ok":false/.test(out)) process.exit(code || 1);
  process.exit(0);
});
