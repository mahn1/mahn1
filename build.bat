@echo off
setlocal
cd /d "%~dp0"
title Elisa Viora 1.0 - build

where dotnet >nul 2>nul
if errorlevel 1 (
  echo ERROR: .NET 8 SDK not found. Install it from https://dotnet.microsoft.com/download
  exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js and npm not found. Install Node.js from https://nodejs.org/
  exit /b 1
)

echo [1/4] Installing interface dependencies...
call npm ci
if errorlevel 1 goto error

echo [2/4] Building interface...
call npm run build
if errorlevel 1 goto error

echo [3/4] Publishing Windows x64 application...
dotnet publish Elisa.Desktop\Elisa.Desktop.csproj -c Release -r win-x64 --self-contained true -o "%~dp0build\Elisa" -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true
if errorlevel 1 goto error

echo [4/4] Copying interface files...
if exist "%~dp0build\Elisa\wwwroot" rmdir /s /q "%~dp0build\Elisa\wwwroot"
xcopy "%~dp0dist\*" "%~dp0build\Elisa\wwwroot\" /e /i /y >nul
if errorlevel 1 goto error

echo.
echo Done! Run build\Elisa\Elisa.exe
 echo Keep the wwwroot folder next to Elisa.exe.
exit /b 0

:error
echo.
echo Build failed. See the error above.
exit /b 1
