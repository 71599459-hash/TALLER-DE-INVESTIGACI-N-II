import { cp, mkdir, readFile, rm } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { resolve, join } from 'node:path';
import { ROOT, DATA, exists, within, portOccupied, saveJson, usageFailure } from './lib.mjs';

async function main() {
  if (!await exists(join(DATA, 'aularaiz.sqlite'))) {
    throw new Error('No existe data/aularaiz.sqlite. Inicia AulaRaíz al menos una vez.');
  }
  for (const port of [4173, 4174]) {
    if (await portOccupied(port)) {
      throw new Error(`Hay un servicio activo en el puerto ${port}. Detén AulaRaíz antes de respaldar SQLite.`);
    }
  }

  const target = resolve(process.argv[2] || resolve(ROOT, 'respaldos'));
  if (within(DATA, target) || within(target, DATA)) {
    throw new Error('El directorio de respaldos debe estar fuera de la carpeta de datos.');
  }
  await mkdir(target, { recursive: true });
  const name = 'AulaRaiz-datos-' + new Date().toISOString().replace(/[-:]/g, '').slice(0, 15).replace('T', '-') + '-' +
    randomBytes(3).toString('hex');
  const folder = join(target, name);
  await mkdir(folder, { mode: 0o700 });
  try {
    await cp(DATA, join(folder, 'data'), { recursive: true, errorOnExist: true, force: false });
    await saveJson(join(folder, 'respaldo.json'), {
      createdAt: new Date().toISOString(),
      source: DATA,
      type: 'copia-completa-con-servidor-detenido',
      includes: ['SQLite', 'uploads', 'sesiones y hashes'],
      restore: 'Detén el servidor y reemplaza la carpeta data por la carpeta data del respaldo.'
    });
  } catch (error) {
    await rm(folder, { recursive: true, force: true });
    throw error;
  }
  console.log('Respaldo creado en:', folder);
  console.log('Contiene datos de usuarios y sesiones. No lo publiques en GitHub.');
}

main().catch(error => usageFailure(error.message));
