@echo off
setlocal

set "ROOT=%~dp0"
set "APP=%ROOT%D35 Converter App.ps1"

if not exist "%APP%" (
  echo D35 Converter App.ps1 was not found.
  echo.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%APP%"
