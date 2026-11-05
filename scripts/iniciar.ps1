param([switch]$NoAbrir)
$ErrorActionPreference = 'Stop'
$projectPath = Split-Path -Parent $PSScriptRoot
$healthUrl = 'http://127.0.0.1:4173/api/health'
$running = $false
try {
    $health = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 2
    $running = $health.ok -and $health.version
} catch { }
if (-not $running) {
    $nodePath = Join-Path $projectPath 'tools\node.exe'
    if (-not (Test-Path -LiteralPath $nodePath)) {
        $nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
        if ($nodeCommand) { $nodePath = $nodeCommand.Source }
        else { throw 'No se encontró Node.js. Instala Node.js 24 LTS o usa la copia portátil incluida en tools.' }
    }
    $nodeVersion = & $nodePath -p 'process.versions.node'
    $nodeParts = $nodeVersion.Split('.')
    if ([int]$nodeParts[0] -lt 22 -or ([int]$nodeParts[0] -eq 22 -and [int]$nodeParts[1] -lt 13)) { throw 'Se necesita Node.js 22.13 o superior. Se recomienda Node.js 24 LTS.' }
    $logPath = Join-Path $projectPath 'logs'
    New-Item -ItemType Directory -Path $logPath -Force | Out-Null
    $entryPath = Join-Path $projectPath 'server\index.mjs'
    $serverProcess = Start-Process -FilePath $nodePath -ArgumentList @(('"' + $entryPath + '"')) -WorkingDirectory $projectPath -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logPath 'servidor.log') -RedirectStandardError (Join-Path $logPath 'errores.log') -PassThru
    Set-Content -LiteralPath (Join-Path $logPath 'servidor.pid') -Value $serverProcess.Id -Encoding ascii
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        Start-Sleep -Milliseconds 300
        try { $health = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 1; if ($health.ok) { $running = $true; break } } catch { }
        if ($serverProcess.HasExited) { break }
    }
    if (-not $running) { throw ('El servidor no inició. Revisa ' + (Join-Path $logPath 'errores.log')) }
}
Write-Host 'AulaRaíz está disponible en http://localhost:4173' -ForegroundColor Green
Write-Host 'Alumno: alumno@aularaiz.local / Alumno2026!'
Write-Host 'Docente: docente@aularaiz.local / Docente2026!'
if (-not $NoAbrir) { Start-Process 'http://localhost:4173' }
