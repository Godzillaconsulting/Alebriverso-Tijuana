# ============================================================
#  TIJUANA: Alebrije en Vacaciones — Dev Server (PowerShell)
# ============================================================

$Host.UI.RawUI.WindowTitle = "TIJUANA: Alebrije en Vacaciones — Dev Server"

Write-Host ""
Write-Host " ████████╗██╗     ██╗ █████╗ ██╗   ██╗ █████╗ ███╗   ██╗ █████╗ " -ForegroundColor Cyan
Write-Host " ╚══██╔══╝██║     ██║██╔══██╗██║   ██║██╔══██╗████╗  ██║██╔══██╗" -ForegroundColor Cyan
Write-Host "    ██║   ██║     ██║███████║██║   ██║███████║██╔██╗ ██║███████║" -ForegroundColor Cyan
Write-Host "    ██║   ██║██   ██║██╔══██║██║   ██║██╔══██║██║╚██╗██║██╔══██║" -ForegroundColor Cyan
Write-Host "    ██║   ██║╚█████╔╝██║  ██║╚██████╔╝██║  ██║██║ ╚████║██║  ██║" -ForegroundColor Cyan
Write-Host "    ╚═╝   ╚═╝ ╚════╝ ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝" -ForegroundColor Cyan
Write-Host ""
Write-Host " TIJUANA: Alebrije en Vacaciones — Dev Server" -ForegroundColor Magenta
Write-Host " ==============================================" -ForegroundColor Magenta
Write-Host ""

# Mover al directorio del script
Set-Location -Path $PSScriptRoot

# Verificar que npx esté disponible
if (-not (Get-Command npx -ErrorAction SilentlyContinue)) {
    Write-Host " [ERROR] npx no encontrado. Instala Node.js desde https://nodejs.org" -ForegroundColor Red
    Read-Host "Presiona Enter para salir"
    exit 1
}

Write-Host " [OK] Node.js / npx encontrado." -ForegroundColor Green
Write-Host " [>>] Abriendo http://localhost:5500 en tu navegador..." -ForegroundColor Yellow
Write-Host ""
Write-Host " Presiona Ctrl+C para detener el servidor." -ForegroundColor DarkGray
Write-Host ""

# Abrir navegador automáticamente después de 2 segundos
Start-Job -ScriptBlock {
    Start-Sleep -Seconds 2
    Start-Process "http://localhost:5500"
} | Out-Null

# Lanzar servidor con CORS habilitado
npx serve . --listen 5500 --cors

Write-Host ""
Write-Host " Servidor detenido." -ForegroundColor Yellow
Read-Host "Presiona Enter para salir"
