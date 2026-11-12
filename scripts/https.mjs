import { spawnSync } from 'node:child_process';
import { cp, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { homedir, networkInterfaces } from 'node:os';
import { isIP } from 'node:net';
import { ROOT, exists, saveJson, usageFailure } from './lib.mjs';

const certs = resolve(ROOT, 'certs');
const certificate = join(certs, 'server.pem');
const privateKey = join(certs, 'server-key.pem');

function mkcertCommand() {
  const bundled = resolve(ROOT, 'tools', 'mkcert.exe');
  return process.platform === 'win32' ? bundled : 'mkcert';
}

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    env,
    stdio: 'inherit',
    windowsHide: false
  });
  if (result.error) throw new Error(`No se pudo ejecutar ${command}: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${command} terminó con código ${result.status}.`);
}

function ipv4Addresses() {
  return [...new Set(Object.values(networkInterfaces()).flatMap(items =>
    (items || []).filter(item => item.family === 'IPv4' && !item.internal && !item.address.startsWith('169.254.'))
      .map(item => item.address)))];
}

async function configure() {
  if (!process.argv.includes('--confiar')) {
    throw new Error('Para instalar la autoridad local de pruebas, ejecuta: npm run https:configurar -- --confiar [IPv4]. Este paso modifica la confianza de certificados del equipo.');
  }
  const addresses = process.argv.slice(3).filter(arg => arg !== '--confiar');
  const ips = addresses.length ? addresses : ipv4Addresses();
  for (const ip of ips) {
    if (isIP(ip) !== 4) throw new Error(`Dirección IPv4 no válida: ${ip}`);
  }
  const cmd = mkcertCommand();
  if (process.platform === 'win32' && !await exists(cmd)) {
    throw new Error('Falta tools/mkcert.exe. Descárgalo de https://github.com/FiloSottile/mkcert/releases.');
  }
  await mkdir(certs, { recursive: true });
  const caRoot = process.platform === 'win32'
    ? resolve(process.env.LOCALAPPDATA || homedir(), 'AulaRaiz', 'mkcert-ca')
    : resolve(homedir(), '.local', 'share', 'aularaiz', 'mkcert-ca');
  await mkdir(caRoot, { recursive: true });
  const env = { ...process.env, CAROOT: caRoot };

  console.log('Se instalará una autoridad local de pruebas. Confirma cualquier solicitud del sistema.');
  run(cmd, ['-install'], env);
  run(cmd, ['-cert-file', certificate, '-key-file', privateKey,
    'localhost', '127.0.0.1', '::1', ...ips], env);
  const publicRootCA = join(caRoot, 'rootCA.pem');
  if (!await exists(publicRootCA)) throw new Error('mkcert no generó rootCA.pem.');
  const publicFolder = resolve(ROOT, 'instalacion');
  await mkdir(publicFolder, { recursive: true });
  await cp(publicRootCA, join(publicFolder, 'AulaRaiz-CA.crt'));
  await saveJson(join(certs, 'config.json'), {
    generatedAt: new Date().toISOString(),
    addresses: ips,
    port: 4174,
    certificate: 'certs/server.pem',
    privateKey: 'certs/server-key.pem',
    publicCA: 'instalacion/AulaRaiz-CA.crt'
  });
  console.log('HTTPS preparado. Inicia con: npm run https:iniciar');
  for (const ip of ips) console.log(`Red local: https://${ip}:4174/`);
  console.log('Para el celular, instala y confía únicamente en el certificado público de esta autoridad local.');
  console.log('No compartas las claves privadas server-key.pem ni rootCA-key.pem.');
}

async function startHttps() {
  if (!await exists(certificate) || !await exists(privateKey)) {
    throw new Error('Faltan certificados HTTPS. Primero ejecuta npm run https:configurar -- --confiar');
  }
  const script = resolve(ROOT, 'server', 'index.mjs');
  run(process.execPath, [script], {
    ...process.env,
    PORT: '4174',
    HTTPS_CERT: certificate,
    HTTPS_KEY: privateKey
  });
}

const command = process.argv[2];
if (command === 'configurar') await configure().catch(error => usageFailure(error.message));
else if (command === 'iniciar') await startHttps().catch(error => usageFailure(error.message));
else usageFailure('Uso: node scripts/https.mjs configurar|iniciar');
