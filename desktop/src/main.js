/* Floor Plan 3D — Electron main process
 *
 * - Serves the app through a privileged app:// protocol (ES modules don't
 *   load over file://, so this is required for the bundled Three.js).
 * - Hardware-accelerated, GPU-rasterized rendering for smooth 3D.
 * - Native Windows Open/Save dialogs + app menu with Ctrl+N/O/S/E.
 * - Window state persistence, single-instance, power-save blocker.
 */
const { app, BrowserWindow, Menu, ipcMain, dialog, protocol, powerSaveBlocker, shell, session } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;

const APP_ROOT = path.join(__dirname, '..', 'app');
const APP_ORIGIN = 'app://local';
const SMOKE = !!process.env.FP_SMOKE;

/* ---------- Privileged scheme (must be registered before app ready) ---------- */
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }
]);

/* ---------- Performance switches ---------- */
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');

/* ---------- Small helpers ---------- */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.gltf': 'model/gltf+json',
  '.glb': 'model/gltf-binary',
  '.bin': 'application/octet-stream',
  '.ktx2': 'image/ktx2'
};

const statePath = () => path.join(app.getPath('userData'), 'window-state.json');

function readWindowState(){
  const fallback = { width: 1440, height: 900 };
  try {
    const s = JSON.parse(fs.readFileSync(statePath(), 'utf8'));
    if (!s.width || !s.height) return fallback;
    // Keep the window on-screen (in case the monitor layout changed)
    const { screen } = require('electron');
    const area = screen.getPrimaryDisplay().workArea;
    const x = Number.isFinite(s.x) ? Math.min(Math.max(s.x, area.x - 40), area.x + area.width - 120) : undefined;
    const y = Number.isFinite(s.y) ? Math.min(Math.max(s.y, area.y - 40), area.y + area.height - 80) : undefined;
    return { width: s.width, height: s.height, x, y };
  } catch { return fallback; }
}

function serveAppFile(requestUrl){
  if (SMOKE) console.log('[trace] serve:', requestUrl);
  let pathname;
  try { pathname = new URL(requestUrl).pathname; }
  catch { return new Response('Bad Request', { status: 400 }); }
  const rel = decodeURIComponent(pathname).replace(/^\/+/, '');
  const file = path.normalize(path.join(APP_ROOT, rel));
  if (!file.startsWith(APP_ROOT)) return new Response('Forbidden', { status: 403 });
  return fsp.readFile(file).then(
    data => new Response(data, { headers: { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' } }),
    () => new Response('Not Found', { status: 404 })
  );
}

/* ---------- Window ---------- */
let win = null;

function createWindow(){
  if (SMOKE) console.log('[trace] createWindow');
  const b = readWindowState();
  win = new BrowserWindow({
    width: b.width,
    height: b.height,
    ...(b.x !== undefined ? { x: b.x, y: b.y } : {}),
    minWidth: 980,
    minHeight: 640,
    backgroundColor: '#f4efe8',
    show: false,
    title: 'Floor Plan 3D — Interior Design',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
      spellcheck: false
    }
  });
  win.once('ready-to-show', () => win.show());
  if (SMOKE) console.log('[trace] loadURL:', APP_ORIGIN + '/index.html');
  win.loadURL(APP_ORIGIN + '/index.html').then(
    () => { if (SMOKE) console.log('[trace] loadURL resolved'); },
    e => { if (SMOKE) console.log('[trace] loadURL rejected:', String(e)); }
  );

  // Persist window bounds
  win.on('close', () => {
    try { fs.writeFileSync(statePath(), JSON.stringify({ ...win.getBounds(), maximized: win.isMaximized() })); } catch {}
  });
  win.on('closed', () => { win = null; });

  // Open external links (if any) in the system browser instead of the app
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  // Smoke-test mode (used by scripts/smoke.mjs in CI / sandbox verification)
  if (SMOKE) smokeTest(win);
}

/* ---------- Smoke test ---------- */
function smokeTest(win){
  const errors = [];
  if (SMOKE) process.on('uncaughtException', err => {
    console.log('SMOKE_RESULT ' + JSON.stringify({ ok: false, errors: ['uncaughtException: ' + String(err)] }));
    app.exit(1);
  });
  win.webContents.on('console-message', (...args) => {
    const d = args[0] && typeof args[0] === 'object' && 'level' in args[0] ? args[0] : { level: args[1], message: args[2] };
    if (d.level >= 2) errors.push(String(d.message));
  });
  win.webContents.on('did-fail-load', (_e, code, desc) => errors.push('did-fail-load ' + code + ' ' + desc));
  win.webContents.on('did-finish-load', () => {
    setTimeout(() => {
      win.webContents.executeJavaScript('({ svg: !!document.querySelector("svg"), header: !!document.querySelector("header"), three: typeof window.View3D, dsk: typeof window.floorplanDesktop, dskApi: window.floorplanDesktop ? [typeof window.floorplanDesktop.saveDataUrl, typeof window.floorplanDesktop.openText, typeof window.floorplanDesktop.onMenu].join(",") : "" })')
        .then(probe => {
          console.log('SMOKE_RESULT ' + JSON.stringify({ ok: errors.length === 0, errors, probe }));
          app.exit(errors.length === 0 ? 0 : 1);
        })
        .catch(err => { console.log('SMOKE_RESULT ' + JSON.stringify({ ok: false, errors: [String(err)] })); app.exit(1); });
    }, 3500);
  });
}

/* ---------- Menu ---------- */
function sendMenu(id){ if (win && !win.isDestroyed()) win.webContents.send('menu:' + id); }

function showAbout(){
  dialog.showMessageBox(win, {
    type: 'info',
    title: 'About Floor Plan 3D',
    message: 'Floor Plan 3D — Interior Design',
    detail: 'Version ' + app.getVersion() + '\nDeveloped by Hazhir · Built with AI assistance.\n\n2D planning (SVG) + 3D visualization and first-person walk mode (Three.js).\nWorks fully offline — no internet connection required.',
    buttons: ['OK']
  });
}

function buildMenu(){
  const template = [
    { label: 'File', submenu: [
      { label: 'New Plan', accelerator: 'CmdOrCtrl+N', click: () => sendMenu('new') },
      { label: 'Open Plan…', accelerator: 'CmdOrCtrl+O', click: () => sendMenu('open') },
      { label: 'Save Plan As…', accelerator: 'CmdOrCtrl+S', click: () => sendMenu('save') },
      { type: 'separator' },
      { label: 'Export Image', accelerator: 'CmdOrCtrl+E', click: () => sendMenu('image') },
      { type: 'separator' },
      { role: 'quit', label: 'Exit' }
    ] },
    // NOTE: no undo/redo roles here — the app implements its own Ctrl+Z / Ctrl+Shift+Z,
    // and menu accelerators would swallow those keystrokes before the page sees them.
    { label: 'Edit', submenu: [
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'selectAll' }
    ] },
    { role: 'viewMenu', label: 'View' },
    { role: 'windowMenu', label: 'Window' },
    { role: 'help', submenu: [ { label: 'About Floor Plan 3D', click: showAbout } ] }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/* ---------- IPC (native file dialogs) ---------- */
function registerIpc(){
  ipcMain.handle('fp:save', async (_ev, opts = {}) => {
    const isJson = /\.json$/i.test(opts.defaultName || '');
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      defaultPath: opts.defaultName || 'floor-plan-design.png',
      filters: isJson
        ? [{ name: 'Floor Plan (JSON)', extensions: ['json'] }]
        : [{ name: 'PNG Image', extensions: ['png'] }]
    });
    if (canceled || !filePath) return null;
    const b64 = String(opts.dataUrl || '').split(',')[1] || '';
    await fsp.writeFile(filePath, Buffer.from(b64, 'base64'));
    return filePath;
  });

  ipcMain.handle('fp:open', async (_ev, opts = {}) => {
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      filters: opts.filters || [{ name: 'Floor Plan (JSON)', extensions: ['json'] }],
      properties: ['openFile']
    });
    if (canceled || !filePaths[0]) return null;
    return { name: path.basename(filePaths[0]), path: filePaths[0], content: await fsp.readFile(filePaths[0], 'utf8') };
  });
}

/* ---------- App lifecycle ---------- */
const gotLock = app.requestSingleInstanceLock();
if (!gotLock){
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win){
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    if (SMOKE) console.log('[trace] app ready');
    app.setAppUserModelId('com.hazhir.floorplan3d');

    protocol.handle('app', request => serveAppFile(request.url));

    // Hardened CSP for the packaged app (the web build keeps its original behavior)
    session.defaultSession.webRequest.onHeadersReceived((details, cb) => {
      if (details.url.startsWith(APP_ORIGIN)){
        cb({ responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [
          "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:"
        ] } });
      } else cb({});
    });

    // Keep the app from being suspended by power management (smooth 3D during long sessions)
    powerSaveBlocker.start('prevent-app-suspension');
    if (SMOKE) console.log('[trace] protocol+csp+psb+ipc done, building menu');

    registerIpc();
    buildMenu();
    createWindow();

    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  });
}

app.on('window-all-closed', () => app.quit());
