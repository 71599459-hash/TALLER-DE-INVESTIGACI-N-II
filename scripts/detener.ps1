$ErrorActionPreference = 'Stop'
$projectPath = Split-Path -Parent $PSScriptRoot
$pidPath = Join-Path $projectPath 'logs\servidor.pid'
if (-not (Test-Path -LiteralPath $pidPath)) { Write-Host 'No hay un servidor iniciado por el acceso local.'; exit 0 }
$serverPid = [int](Get-Content -LiteralPath $pidPath -Raw).Trim()
$serverInfo = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $serverPid) -ErrorAction SilentlyContinue
$expectedEntry = Join-Path $projectPath 'server\index.mjs'
if ($serverInfo -and $serverInfo.Name -eq 'node.exe' -and $serverInfo.CommandLine.Contains($expectedEntry)) {
    Stop-Process -Id $serverPid
    Write-Host 'Servidor AulaRaíz detenido. Los datos se conservan.'
} elseif ($serverInfo) { throw 'El identificador pertenece a otro proceso. No se detuvo ningún programa.' }
Remove-Item -LiteralPath $pidPath -Force
