# Floor Plan 3D — Windows Desktop App (Electron)

Offline desktop edition of the Floor Plan 3D interior-design app.
Everything runs **100% locally** — no internet connection needed at any point after install.

## Why Electron?

| Considered | Verdict |
|---|---|
| **Electron** ✅ | Bundled Chromium → identical, predictable WebGL rendering on every PC; native file dialogs & menus; mature Windows packaging via electron-builder |
| Tauri | Much smaller binaries, but needs a Rust toolchain and depends on the system WebView2 for rendering |
| NW.js / Neutralino / Wails | Less mature packaging & WebGL story for this use case |

## What the desktop edition adds

- **Native Windows feel** — real Open/Save dialogs, app menu (`File / Edit / View / Window / Help`), proper taskbar icon & name
- **Keyboard shortcuts** — `Ctrl+N` new plan · `Ctrl+O` open plan · `Ctrl+S` save plan · `Ctrl+E` export image
- **Fast & smooth 3D** — GPU-rasterization + zero-copy rendering switches, background throttling disabled, power-save suspension blocked during long sessions
- **Fully offline** — Three.js r160 + all addons are vendored locally (`public/vendor/`), the app is served through a private `app://` protocol (no file:// module issues)
- **Secure by default** — context isolation + sandboxed renderer, no Node in the page, hardened CSP
- **Quality-of-life** — window size/position remembered, single-instance lock, DPI-aware

## Build on Windows (one click)

1. Install [Node.js 18+](https://nodejs.org) (needed once, to build)
2. Double-click **`build-windows.bat`** in the repo root

Outputs land in `desktop/dist/`:

| File | What it is |
|---|---|
| `FloorPlan3D-Setup-1.0.0.exe` | Full installer (desktop + Start-menu shortcuts, uninstaller) |
| `FloorPlan3D-Portable-1.0.0.exe` | Single-file portable exe — just copy & run, no install |

Manual equivalent:

```bat
cd desktop
npm install
npm run dist
```

## No Windows machine? Use GitHub Actions

The included workflow (`.github/workflows/build-windows.yml`) builds both exe files automatically:

1. Push this repository to GitHub
2. Actions tab → **Build Windows Desktop App** → *Run workflow* (or push a `v*` tag)
3. Download `FloorPlan3D-Windows-x64` from the run's **Artifacts**

## Development

```bat
cd desktop
npm install
npm start        # sync app files + launch Electron
npm run smoke    # headless self-test (used in CI)
```

The app code itself lives in **`public/floorplan.html` + `public/vendor/`** (single source of truth, shared with the web version). `npm run sync` copies it into `desktop/app/` for packaging — never edit `desktop/app/` directly.

## Troubleshooting

- **SmartScreen warning** — expected for unsigned exes; click *More info → Run anyway*, or sign it with your own code-signing certificate.
- **"Cannot create symbolic link : A required privilege is not held by the client"** during the build — caused by the winCodeSign package containing macOS symlinks. `npm run dist` now auto-seeds the cache without symlinks (`scripts/fix-wincodesign-cache.mjs`), so this should not happen. If it ever does: enable Windows **Developer Mode** (Settings → Update & Security → For developers), delete `%LOCALAPPDATA%\electron-builder\Cache`, and rebuild — or use the automatic compatibility fallback (`npm run dist:noedit`), which builds fine but with the default Electron exe icon.
- **Black 3D canvas on old GPUs** — the app enables GPU features aggressively; on broken drivers Chromium falls back automatically. As a last resort run with `--disable-gpu`.
- **Installer language** — the NSIS UI is English by default.

## Extending (roadmap-friendly architecture)

- **New furniture / higher-quality assets**: add GLTF/GLB models (optionally Draco/KTX2-compressed) under `public/vendor/assets/`, load with `GLTFLoader` in the 3D module, and register the item in the library catalog.
- **New native features** (print, PDF export, auto-update): add an IPC channel in `desktop/src/preload.js` (renderer-safe API) + handler in `desktop/src/main.js`, then call `window.floorplanDesktop.*` from the page.
- **Auto-updates**: `electron-updater` slots in via electron-builder's publish config when you're ready to ship over the network.
