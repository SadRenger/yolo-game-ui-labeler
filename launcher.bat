@echo off
cd /d "%~dp0"
if exist "_resources_\WebView2Loader.dll" copy /y "_resources_\WebView2Loader.dll" . >nul 2>&1
if exist "resources\WebView2Loader.dll" copy /y "resources\WebView2Loader.dll" . >nul 2>&1
start "" "%~dp0yolo-game-ui-labeler.exe"
