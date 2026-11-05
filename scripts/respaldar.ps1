param([string]$Destino)

$ErrorActionPreference = 'Stop'
$taskProject = Split-Path -Parent $PSScriptRoot
$taskData = [System.IO.Path]::GetFullPath((Join-Path $taskProject 'data'))
if ($env:AULARAIZ_DATA_DIR) { $taskData = [System.IO.Path]::GetFullPath($env:AULARAIZ_DATA_DIR) }
if (-not (Test-Path -LiteralPath (Join-Path $taskData 'aularaiz.sqlite'))) { throw 'Todavia no existe la base de datos. Inicia AulaRaiz al menos una vez.' }

# Un respaldo de todos los binarios y SQLite debe hacerse con el servidor detenido.
foreach ($taskPort in @(4173, 4174)) {
    $taskClient = [System.Net.Sockets.TcpClient]::new()
    try {
        $taskClient.Connect('127.0.0.1', $taskPort)
        throw "Hay un servidor usando el puerto $taskPort. Cierra AulaRaiz con Ctrl+C antes de respaldar y vuelve a ejecutar este script."
    }
    catch [System.Net.Sockets.SocketException] { }
    finally { $taskClient.Dispose() }
}

if (-not $Destino) { $Destino = Join-Path $taskProject 'respaldos' }
$taskDestinationRoot = [System.IO.Path]::GetFullPath($Destino)
if ($taskDestinationRoot -eq $taskData -or $taskDestinationRoot.StartsWith($taskData + [System.IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'El destino de respaldo debe quedar fuera de la carpeta data.' }
New-Item -ItemType Directory -Path $taskDestinationRoot -Force | Out-Null
$taskBackupName = 'AulaRaiz-datos-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [Guid]::NewGuid().ToString('N').Substring(0, 6)
$taskBackupPath = Join-Path $taskDestinationRoot $taskBackupName
New-Item -ItemType Directory -Path $taskBackupPath | Out-Null
Copy-Item -LiteralPath $taskData -Destination (Join-Path $taskBackupPath 'data') -Recurse
[ordered]@{ createdAt = [DateTime]::UtcNow.ToString('o'); source = $taskData; kind = 'complete-stopped-server-data-copy'; includes = @('SQLite', 'uploads', 'sessions', 'password hashes'); restore = 'Detener servidor. Conservar carpeta data actual con otro nombre. Copiar data del respaldo en su lugar. Iniciar servidor.' } | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath (Join-Path $taskBackupPath 'respaldo.json') -Encoding UTF8
Write-Host "Respaldo completo creado: $taskBackupPath"
Write-Host 'Contiene credenciales cifradas por hash y sesiones. Guardalo como informacion privada.'
Write-Host 'No contiene claves HTTPS ni los datos offline almacenados en los navegadores.'
