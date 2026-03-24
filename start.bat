@echo off
title TIJUANA: Alebrije en Vacaciones — Dev Server
echo.
echo  ██████╗░░█████╗░██╗ █████╗░░██████╗
echo  ╚════██╗██╔══██╗██║██╔══██╗██╔════╝
echo  ░░███╔═╝███████║██║╚█████╔╝╚█████╗░
echo  ██╔══╝░░██╔══██║██║██╔══██╗░╚═══██╗
echo  ███████╗██║░░██║██║╚█████╔╝██████╔╝
echo  ╚══════╝╚═╝░░╚═╝╚═╝░╚════╝░╚═════╝░
echo.
echo  TIJUANA: Alebrije en Vacaciones — Dev Server
echo  ============================================
echo.

:: Cambiar al directorio donde está este script
cd /d "%~dp0"

:: Verificar si Node.js / npx están disponibles
where npx >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] npx no encontrado. Instala Node.js desde https://nodejs.org
    pause
    exit /b 1
)

echo  [OK] Node.js encontrado.
echo  [>>] Iniciando servidor en http://localhost:5500 ...
echo.
echo  Presiona Ctrl+C para detener el servidor.
echo.

:: Lanzar el servidor con header CORS explícito
npx serve . --listen 5500 --cors

echo.
echo  Servidor detenido.
pause
