import { unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ROOT, exists, health, loadJson, usageFailure } from './lib.mjs';

async function main() {
  const file = resolve(ROOT, 'logs/servidor.pid');
  if (!(await exists(file))) {
    console.log('No hay una instancia en segundo plano registrada por AulaRaíz.');
    return;
  }
  const record = await loadJson(file);
  if (
    !Number.isSafeInteger(record.pid) ||
    record.pid <= 0 ||
    record.port !== 4173 ||
    typeof record.serverId !== 'string'
  ) {
    throw new Error('El registro del proceso no es válido. No se ha detenido ningún proceso.');
  }
  const current = await health(4173);
  if (!current) {
    // Un registro de una ejecución anterior no justifica matar un PID reutilizado.
    await unlink(file);
    console.log('No hay un servidor AulaRaíz activo en el puerto 4173. Se limpió el registro anterior.');
    return;
  }
  if (current.serverId !== record.serverId) {
    throw new Error('El puerto 4173 pertenece a otra ejecución. No se detuvo ningún proceso.');
  }
  try {
    process.kill(record.pid, 'SIGTERM');
  } catch (error) {
    if (error.code !== 'ESRCH') throw error;
  }
  await unlink(file);
  console.log('Se solicitó detener AulaRaíz. Los datos en SQLite permanecen guardados.');
}

main().catch((error) => usageFailure(error.message));
