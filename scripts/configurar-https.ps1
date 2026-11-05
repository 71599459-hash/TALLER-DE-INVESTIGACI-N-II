param(
    [string[]]$DireccionesIP = @(),
    [switch]$SoloDescargar
)

$ErrorActionPreference = 'Stop'
$taskProject = Split-Path -Parent $PSScriptRoot
$taskTools = Join-Path $taskProject 'tools'
$taskCerts = Join-Path $taskProject 'certs'
$taskInstall = Join-Path $taskProject 'instalacion'
$taskMkcert = Join-Path $taskTools 'mkcert.exe'
$taskRelease = 'v1.4.4'
$taskArchitecture = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'arm64' } else { 'amd64' }
$taskAssetName = "mkcert-$taskRelease-windows-$taskArchitecture.exe"
$taskOfficialUrl = "https://github.com/FiloSottile/mkcert/releases/download/$taskRelease/$taskAssetName"

New-Item -ItemType Directory -Path $taskTools -Force | Out-Null
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

if (-not (Test-Path -LiteralPath $taskMkcert)) {
    $taskInstalledCommand = Get-Command mkcert.exe -ErrorAction SilentlyContinue
    if ($taskInstalledCommand) {
        $taskMkcert = $taskInstalledCommand.Source
        Write-Host "Se usara mkcert ya instalado: $taskMkcert"
    }
    else {
        Write-Host "Descargando herramienta oficial: $taskOfficialUrl"
        $taskTemp = Join-Path $taskTools ('mkcert-' + [Guid]::NewGuid().ToString('N') + '.download')
        try {
            Invoke-WebRequest -Uri $taskOfficialUrl -OutFile $taskTemp -UseBasicParsing
            $taskHash = (Get-FileHash -LiteralPath $taskTemp -Algorithm SHA256).Hash.ToLowerInvariant()
            $taskOfficialDigest = $null
            try {
                $taskMetadata = Invoke-RestMethod -Uri "https://api.github.com/repos/FiloSottile/mkcert/releases/tags/$taskRelease" -Headers @{ 'User-Agent' = 'AulaRaiz-Local-Setup' }
                $taskAsset = @($taskMetadata.assets | Where-Object { $_.name -eq $taskAssetName }) | Select-Object -First 1
                if ($taskAsset -and $taskAsset.PSObject.Properties.Name -contains 'digest' -and $taskAsset.digest) { $taskOfficialDigest = [string]$taskAsset.digest }
            }
            catch { Write-Host 'No fue posible consultar metadatos adicionales de GitHub. La descarga usa la URL oficial HTTPS.' }
            if ($taskOfficialDigest -and $taskOfficialDigest.StartsWith('sha256:')) {
                if ($taskHash -ne $taskOfficialDigest.Substring(7).ToLowerInvariant()) { throw 'El SHA256 no coincide con el digest oficial. No se ejecutara la herramienta.' }
                Write-Host 'SHA256 comparado con el digest oficial de GitHub.'
            }
            else { Write-Host 'Esta version no publica digest SHA256 en GitHub. Se guardara el hash local como inventario, sin afirmar verificacion independiente.' }
            Move-Item -LiteralPath $taskTemp -Destination $taskMkcert
            [ordered]@{ name = 'mkcert'; version = $taskRelease; source = $taskOfficialUrl; sha256 = $taskHash; officialDigest = $taskOfficialDigest; downloadedAt = [DateTime]::UtcNow.ToString('o') } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $taskTools 'mkcert-origen.json') -Encoding UTF8
            Invoke-WebRequest -Uri "https://raw.githubusercontent.com/FiloSottile/mkcert/$taskRelease/LICENSE" -OutFile (Join-Path $taskTools 'MKCERT-LICENSE.txt') -UseBasicParsing
        }
        catch {
            if (Test-Path -LiteralPath $taskTemp) { Remove-Item -LiteralPath $taskTemp -Force }
            throw "No se pudo preparar mkcert. Revisa internet o descarga la herramienta oficial manualmente en tools\mkcert.exe. Detalle: $($_.Exception.Message)"
        }
    }
}

& $taskMkcert -version
if ($LASTEXITCODE -ne 0) { throw 'mkcert no pudo ejecutarse en esta PC.' }
if ($SoloDescargar) {
    Write-Host 'Herramienta preparada. No se instalaron certificados ni se modifico la confianza del sistema.'
    exit 0
}

if ($DireccionesIP.Count -eq 0) {
    $DireccionesIP = @([System.Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces() |
        Where-Object { $_.OperationalStatus -eq [System.Net.NetworkInformation.OperationalStatus]::Up -and $_.NetworkInterfaceType -ne [System.Net.NetworkInformation.NetworkInterfaceType]::Loopback -and $_.NetworkInterfaceType -ne [System.Net.NetworkInformation.NetworkInterfaceType]::Tunnel } |
        ForEach-Object { $_.GetIPProperties().UnicastAddresses } |
        Where-Object { $_.Address.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork -and -not $_.Address.ToString().StartsWith('169.254.') } |
        ForEach-Object { $_.Address.ToString() } | Sort-Object -Unique)
}
foreach ($taskIp in $DireccionesIP) {
    $taskParsedIp = $null
    if (-not [System.Net.IPAddress]::TryParse($taskIp, [ref]$taskParsedIp) -or $taskParsedIp.AddressFamily -ne [System.Net.Sockets.AddressFamily]::InterNetwork) { throw "Direccion IPv4 invalida: $taskIp" }
}

New-Item -ItemType Directory -Path $taskCerts -Force | Out-Null
New-Item -ItemType Directory -Path $taskInstall -Force | Out-Null
$taskPreviousCAROOT = $env:CAROOT
try {
    # La clave de la autoridad queda fuera de la carpeta compartible del proyecto.
    $env:CAROOT = Join-Path $env:LOCALAPPDATA 'AulaRaiz\mkcert-ca'
    Write-Host ''
    Write-Host 'Se agregara una autoridad local de pruebas al almacen de confianza de esta PC.'
    Write-Host 'Windows puede solicitar permiso del sistema. Este paso es para la demostracion en red local.'
    & $taskMkcert -install
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo instalar la autoridad local. Revisa el mensaje de mkcert.' }
    $taskServerCert = Join-Path $taskCerts 'server.pem'
    $taskServerKey = Join-Path $taskCerts 'server-key.pem'
    $taskNames = @('localhost', '127.0.0.1', '::1') + @($DireccionesIP)
    & $taskMkcert -cert-file $taskServerCert -key-file $taskServerKey @taskNames
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo generar el certificado HTTPS.' }
    $taskRootCert = Join-Path $env:CAROOT 'rootCA.pem'
    if (-not (Test-Path -LiteralPath $taskRootCert)) { throw 'No se encontro el certificado publico de la autoridad.' }
    # Copiar exclusivamente el certificado publico. Nunca copiar rootCA-key.pem.
    Copy-Item -LiteralPath $taskRootCert -Destination (Join-Path $taskInstall 'AulaRaiz-CA.crt') -Force
    [ordered]@{ configuredAt = [DateTime]::UtcNow.ToString('o'); addresses = @($DireccionesIP); port = 4174; certificate = 'certs/server.pem'; key = 'certs/server-key.pem'; publicCA = 'instalacion/AulaRaiz-CA.crt' } | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath (Join-Path $taskCerts 'config.json') -Encoding UTF8
}
finally { $env:CAROOT = $taskPreviousCAROOT }

Write-Host ''
Write-Host 'HTTPS configurado. Inicia scripts\iniciar-https.ps1 y conserva abierta la ventana.'
Write-Host 'En el celular, instala y confia el certificado publico instalacion\AulaRaiz-CA.crt.'
Write-Host 'Nunca transfieras server-key.pem ni la clave privada de la autoridad.'
foreach ($taskIp in $DireccionesIP) { Write-Host "En la misma red Wi-Fi: https://${taskIp}:4174" }
if ($DireccionesIP.Count -eq 0) { Write-Host 'No se detecto IPv4 de red local. Conecta la PC a Wi-Fi y vuelve a configurar antes de usar el celular.' }
Write-Host 'Si cambia la IP de la PC, vuelve a ejecutar este script y usa la nueva direccion.'
Write-Host 'Referencia oficial: https://github.com/FiloSottile/mkcert#mobile-devices'
