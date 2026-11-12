import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  existsSync,
  rmSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { ROOT, within } from '../scripts/lib.mjs';

test('la ruta de respaldos se comprueba sin confundir carpetas hermanas', () => {
  const root = resolve(ROOT, 'data');
  assert.equal(within(root, join(root, 'uploads')), true);
  assert.equal(within(root, resolve(ROOT, 'respaldos')), false);
  assert.equal(within(resolve(ROOT, 'respaldos'), root), false);
});

test('respaldo completo conserva SQLite y archivos, sin modificar los originales', () => {
  const root = mkdtempSync(join(tmpdir(), 'aularaiz-respaldo-test-'));
  try {
    const data = join(root, 'data');
    const backup = join(root, 'respaldos');
    mkdirSync(join(data, 'uploads'), { recursive: true });
    writeFileSync(join(data, 'aularaiz.sqlite'), Buffer.from([1, 2, 3]));
    writeFileSync(join(data, 'uploads', 'lectura.pdf'), Buffer.from('material de prueba'));

    execFileSync(process.execPath, [resolve(ROOT, 'scripts/respaldar.mjs'), backup], {
      cwd: ROOT,
      env: { ...process.env, AULARAIZ_DATA_DIR: data },
      timeout: 10000
    });
    const entries = readdirSync(backup);
    assert.equal(entries.length, 1);
    const folder = join(backup, entries[0]);
    assert.deepEqual(readFileSync(join(folder, 'data/aularaiz.sqlite')), Buffer.from([1, 2, 3]));
    assert.equal(readFileSync(join(folder, 'data/uploads/lectura.pdf'), 'utf8'), 'material de prueba');
    assert.equal(existsSync(join(data, 'aularaiz.sqlite')), true);
    const manifest = JSON.parse(readFileSync(join(folder, 'respaldo.json'), 'utf8'));
    assert.equal(manifest.type, 'copia-completa-con-servidor-detenido');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('HTTPS no modifica la confianza del equipo sin confirmación explícita', () => {
  assert.throws(
    () =>
      execFileSync(process.execPath, [resolve(ROOT, 'scripts/https.mjs'), 'configurar'], {
        cwd: ROOT,
        timeout: 10000,
        stdio: 'pipe'
      }),
    (error) => error.status === 1 && String(error.stderr).includes('--confiar')
  );
});
