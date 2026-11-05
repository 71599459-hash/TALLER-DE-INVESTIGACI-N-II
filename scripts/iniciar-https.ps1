$ErrorActionPreference = 'Stop'
$taskProject = Split-Path -Parent $PSScriptRoot
$taskCertificate = Join-Path $taskProject 'certs\server.pem'
$taskPrivateKey = Join-Path $taskProject 'certs\server-key.pem'
if (-not (Test-Path -LiteralPath $taskCertificate) -or -not (Test-Path -LiteralPath $taskPrivateKey)) {
    throw 'Primero ejecuta scripts\configurar-https.ps1. Para preparar sin modificar certificados, usa -SoloDescargar.'
}
$taskNode = Join-Path $taskProject 'tools\node.exe'
if (-not (Test-Path -LiteralPath $taskNode)) {
    $taskNodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
    if (-not $taskNodeCommand) { throw 'No se encontro Node.js. Instala Node.js 22.13 o posterior desde https://nodejs.org/.' }
    $taskNode = $taskNodeCommand.Source
}
& $taskNode -e "if(process.versions.node.split('.')[0]<22 || (process.versions.node.split('.')[0]==22 && process.versions.node.split('.')[1]<13)){console.error('Se requiere Node.js 22.13 o posterior.');process.exit(1)}"
if ($LASTEXITCODE -ne 0) { throw 'Actualiza Node.js antes de iniciar AulaRaiz.' }
try {
    $taskPortOpen = [System.Net.Sockets.TcpClient]::new()
    $taskPortOpen.Connect('127.0.0.1', 4174)
    $taskPortOpen.Close()
    throw 'El puerto 4174 ya esta ocupado. Cierra la instancia HTTPS anterior antes de iniciar otra.'
}
catch [System.Net.Sockets.SocketException] { }
finally { if ($taskPortOpen) { $taskPortOpen.Dispose() } }

$taskPriorCert = $env:HTTPS_CERT
$taskPriorKey = $env:HTTPS_KEY
$taskPriorPort = $env:PORT
try {
    $env:HTTPS_CERT = $taskCertificate
    $env:HTTPS_KEY = $taskPrivateKey
    $env:PORT = '4174'
    Write-Host 'AulaRaiz HTTPS local. Conserva abierta esta ventana. Detener: Ctrl+C.'
    Write-Host 'Celular y PC deben compartir Wi-Fi. Si Windows pregunta, permite acceso solo en redes privadas.'
    Write-Host 'Si el celular no abre la direccion, comprueba firewall, IP y aislamiento de clientes del Wi-Fi.'
    Write-Host 'Para instalar en el celular, el certificado publico debe estar instalado y ser confiable.'
    & $taskNode (Join-Path $taskProject 'server\index.mjs')
    if ($LASTEXITCODE -ne 0) { throw "El servidor termino con codigo $LASTEXITCODE. Revisa el mensaje anterior." }
}
finally {
    $env:HTTPS_CERT = $taskPriorCert
    $env:HTTPS_KEY = $taskPriorKey
    $env:PORT = $taskPriorPort
}
