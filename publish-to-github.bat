@echo off
REM ============================================================
REM  Floor Plan 3D - publish this project to YOUR GitHub repository
REM  Pre-configured for: https://github.com/hazhirrashidi/floorplan-3d
REM  Requires: Git for Windows (https://git-scm.com/download/win)
REM ============================================================
setlocal
cd /d "%~dp0"

set "REPO_URL=https://github.com/hazhirrashidi/floorplan-3d.git"
set "GH_NAME=Hazhir"
set "GH_EMAIL=hazhirrashidi@users.noreply.github.com"

where git >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Git is not installed. Download it from https://git-scm.com/download/win
  echo         then run this script again.
  pause
  exit /b 1
)

echo ============================================================
echo   Floor Plan 3D  -  publish to GitHub
echo   Repository: %REPO_URL%
echo   Author:     %GH_NAME%
echo ============================================================
echo.
echo TIP: GitHub credits commits by EMAIL. If the contributors list
echo shows an extra entry, paste the exact noreply email from
echo github.com ^> Settings ^> Emails ^> "Keep my email addresses private"
echo It looks like: 12345678+hazhirrashidi@users.noreply.github.com
echo.
set /p "GH_EMAIL=Commit email [press Enter to keep the default]: "

echo.
git config user.name "%GH_NAME%"
git config user.email "%GH_EMAIL%"

REM --- first run: create the local repository ---
if exist .git goto have-repo

echo Creating the local repository...
git init
git branch -M main
git add -A
git commit -m "Floor Plan 3D - initial release by Hazhir"
if errorlevel 1 (
  echo [ERROR] Could not create the initial commit.
  pause
  exit /b 1
)
goto push-now

:have-repo
git rev-parse --verify HEAD >nul 2>nul
if errorlevel 1 (
  echo [ERROR] This repository has no commits yet. Delete the .git folder and run again.
  pause
  exit /b 1
)

REM --- make sure the commit is credited to YOUR account ---
git log -1 --format=%%ae>"%TEMP%\fp3d_author.txt"
set /p LAST_EMAIL=<"%TEMP%\fp3d_author.txt"
if /i not "%LAST_EMAIL%"=="%GH_EMAIL%" (
  echo Fixing the commit author so GitHub credits YOUR account...
  git commit --amend --reset-author --no-edit
  if errorlevel 1 (
    echo [ERROR] Could not rewrite the commit. Close editors using this folder and retry.
    pause
    exit /b 1
  )
)

REM --- publish any changes made since the last run ---
git add -A
git diff --cached --quiet >nul 2>nul
if errorlevel 1 (
  echo Committing your latest changes...
  git commit --amend --reset-author --no-edit
)

:push-now
echo.
git remote remove origin >nul 2>nul
git remote add origin "%REPO_URL%"
echo Pushing to %REPO_URL% ...
echo (A browser window may open asking you to sign in to GitHub - allow it.)
echo.
git push -u origin main
if errorlevel 1 (
  echo.
  echo Your GitHub copy has a different history - updating it to match
  echo this folder...
  git push --force -u origin main
  if errorlevel 1 (
    echo [ERROR] Push failed. Check your internet connection and GitHub login,
    echo         then run this script again.
    pause
    exit /b 1
  )
)

echo.
echo ============================================================
echo  SUCCESS!  https://github.com/hazhirrashidi/floorplan-3d
echo.
echo  Live website : https://hazhirrashidi.github.io/floorplan-3d/
echo  Every push updates the site automatically. If it is not live
echo  yet:  Settings ^> Pages ^> Source: "GitHub Actions"
echo.
echo  Commits are credited to: %GH_NAME% - %GH_EMAIL%
echo  The contributors list refreshes within a few minutes.
echo ============================================================
pause
endlocal
