import { stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { createApp } from './index.mjs';
import { provisionAdministrator } from './access.mjs';

function maskedPassword(question) {
  if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
    throw new Error('Configura AULARAIZ_ADMIN_PASSWORD para ejecutar sin una terminal interactiva.');
  }
  return new Promise((resolve, reject) => {
    let input = '';
    stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();

    const finish = (error) => {
      stdin.off('data', onData);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write('\n');
      if (error) reject(error);
      else resolve(input);
    };
    function onData(chunk) {
      const key = chunk.toString('utf8');
      if (key === '\r' || key === '\n') return finish();
      if (key === '\u0003') return finish(new Error('Operación cancelada.'));
      if (key === '\u007f' || key === '\b') {
        if (input.length) { input = input.slice(0, -1); stdout.write('\b \b'); }
      } else if (key.length === 1 && key >= ' ' && key !== '\u007f') {
        input += key;
        stdout.write('*');
      }
    }
    stdin.on('data', onData);
  });
}

async function run() {
  let name = process.env.AULARAIZ_ADMIN_NAME;
  let email = process.env.AULARAIZ_ADMIN_EMAIL;
  let password = process.env.AULARAIZ_ADMIN_PASSWORD;

  if (!name || !email) {
    if (!stdin.isTTY) throw new Error('Define AULARAIZ_ADMIN_NAME, AULARAIZ_ADMIN_EMAIL y AULARAIZ_ADMIN_PASSWORD.');
    const prompt = createInterface({ input: stdin, output: stdout });
    try {
      name ||= await prompt.question('Nombre del administrador: ');
      email ||= await prompt.question('Correo del administrador: ');
    } finally {
      prompt.close();
    }
  }

  if (!password) {
    password = await maskedPassword('Contraseña (mínimo 10 caracteres): ');
    const confirmation = await maskedPassword('Confirmar contraseña: ');
    if (password !== confirmation) throw new Error('Las contraseñas no coinciden.');
  }

  const app = createApp();
  try {
    const account = provisionAdministrator(app.db, { name, email, password });
    stdout.write(`Administrador configurado: ${account.name} <${account.email}>\n`);
    stdout.write('Ya puedes iniciar AulaRaíz con esta cuenta y abrir Administración.\n');
  } finally {
    app.close();
  }
}

run().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
