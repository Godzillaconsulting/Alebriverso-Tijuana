@echo off
title TIJUANA: Alebrije en Vacaciones — Dev Server
chcp 65001 >nul

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

:: ─────────────────────────────────────────────────────────────
:: MATAR CUALQUIER PROCESO QUE USE EL PUERTO 5500
:: Esto evita que se abran múltiples instancias del servidor
:: ─────────────────────────────────────────────────────────────
echo  [>>] Liberando puerto 5500 si está ocupado...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5500 "') do (
    taskkill /F /PID %%a >nul 2>&1
)
timeout /t 1 /nobreak >nul

:: ─────────────────────────────────────────────────────────────
:: ABRIR EL NAVEGADOR UNA SOLA VEZ (con retardo para que arranque)
:: ─────────────────────────────────────────────────────────────
echo  [>>] Iniciando servidor en http://localhost:5500 ...
echo.
echo  Presiona Ctrl+C para detener el servidor.
echo.

:: Abrir navegador después de 2 segundos (sólo una pestaña)
start "" /b cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:5500"

:: Lanzar el servidor (bloqueante — el bat no termina hasta Ctrl+C)
npx serve . --listen 5500 --cors --no-clipboard

echo.
echo  Servidor detenido.
pause
