import test from 'node:test';
import assert from 'node:assert/strict';
import { clearSession, readSession, saveSession, canResumeOfflineSession } from '../public/session.js';

const token = 'a'.repeat(64);
const saved = {token, serverId: 'servidor-A', user: {id:'alumno',role:'student'}};
function storage() {
  const data = new Map();
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, String(value)); },
    removeItem(key) { data.delete(key); }
  };
}
async function browser(online, run) {
  const names = ['localStorage', 'sessionStorage', 'navigator', 'fetch'];
  const old = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const local = storage();
  const tab = storage();
  for (const [name,value] of Object.entries({
    localStorage: local,
    sessionStorage: tab,
    navigator: {onLine: online},
    fetch: async () => ({ok: true, json: async () => ({serverId: 'servidor-A'})})
  })) Object.defineProperty(globalThis, name, {configurable:true,writable:true,value});
  try { await run({local, tab}); }
  finally {
    for (const name of names) {
      const desc = old.get(name);
      if (desc) Object.defineProperty(globalThis, name, desc);
      else delete globalThis[name];
    }
  }
}

test('una sesión antigua en localStorage no inicia sesión automáticamente', async () => {
  await browser(true, async ({local}) => {
    local.setItem('aularaiz-session', JSON.stringify(saved));
    assert.equal(readSession(), null);
    assert.equal(local.getItem('aularaiz-session'), null);
  });
});

test('la sesión está disponible solo en la pestaña actual', async () => {
  await browser(true, async ({local,tab}) => {
    saveSession(saved);
    assert.deepEqual(readSession(), saved);
    assert.equal(local.getItem('aularaiz-session'), null);
    const anotherTab = storage();
    Object.defineProperty(globalThis, 'sessionStorage', {configurable:true,value:anotherTab});
    assert.equal(readSession(), null);
    Object.defineProperty(globalThis, 'sessionStorage', {configurable:true,value:tab});
    assert.deepEqual(readSession(), saved);
  });
});

test('el servidor disponible exige iniciar sesión incluso al recargar la pestaña', async () => {
  await browser(true, async () => {
    assert.equal(await canResumeOfflineSession(), false);
  });
});

test('si el servidor no responde, se puede retomar el trabajo descargado', async () => {
  await browser(true, async () => {
    globalThis.fetch = async () => { throw Error('Servidor no disponible'); };
    assert.equal(await canResumeOfflineSession(), true);
  });
});

test('una recarga sin conexión conserva la sesión de la pestaña', async () => {
  await browser(false, async () => {
    globalThis.fetch = async () => { throw Error('No hay internet'); };
    assert.equal(await canResumeOfflineSession(), true);
  });
});

test('datos de sesión inválidos se descartan', async () => {
  await browser(true, async ({tab}) => {
    tab.setItem('aularaiz-session', '{incorrecto');
    assert.equal(readSession(), null);
    assert.equal(tab.getItem('aularaiz-session'), null);
    assert.throws(() => saveSession({...saved,serverId:null}), /no es válida/);
  });
});

test('cerrar sesión limpia ambos almacenamientos sin borrar materiales', async () => {
  await browser(true, async ({local,tab}) => {
    saveSession(saved);
    local.setItem('aularaiz-session','anterior');
    clearSession();
    assert.equal(local.getItem('aularaiz-session'), null);
    assert.equal(tab.getItem('aularaiz-session'), null);
  });
});
