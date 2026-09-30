@echo off
REM ============================================================
REM  Floor Plan 3D - one-click Windows build
REM  Produces:  desktop\dist\FloorPlan3D-Setup-1.0.0.exe   (installer)
REM             desktop\dist\FloorPlan3D-Portable-1.0.0.exe (single-file exe)
REM  Requires:  Node.js 18+  (https://nodejs.org)
REM ============================================================
setlocal
cd /d "%~dp0desktop"

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js is not installed. Download it from https://nodejs.org and run this script again.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing dependencies ^(first run, needs internet once^)...
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
  )
)

echo.
echo Building Windows installer + portable exe...
call npm run dist
if errorlevel 1 (
  echo.
  echo ------------------------------------------------------------
  echo  First attempt failed - retrying in compatibility mode
  echo  ^(skips exe icon embedding, avoids Windows symlink rules^)...
  echo ------------------------------------------------------------
  call npm run dist:noedit
  if errorlevel 1 (
    echo.
    echo [ERROR] Build failed. See the log above.
    echo Tip: enabling Windows Developer Mode often fixes electron-builder
    echo issues:  Settings ^> Update ^& Security ^> For developers
    pause
    exit /b 1
  )
  echo.
  echo NOTE: built with the default Electron exe icon. For the custom icon,
  echo enable Windows Developer Mode ^(Settings ^> Update ^& Security ^>
  echo For developers^), delete the %%LOCALAPPDATA%%\electron-builder folder
  echo and rebuild.
)

echo.
echo ============================================================
echo  DONE! Your files are in the desktop\dist folder:
dir /b dist\*.exe 2>nul
echo ============================================================
echo  - FloorPlan3D-Setup-1.0.0.exe    : full installer
echo  - FloorPlan3D-Portable-1.0.0.exe : portable, no install needed
echo.
pause
