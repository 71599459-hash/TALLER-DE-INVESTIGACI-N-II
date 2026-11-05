import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../server/index.mjs';

// Playwright se instala como dependencia de desarrollo.
const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = await import('playwright');
const executablePath = process.env.AULARAIZ_BROWSER || [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].find(existsSync);
// Si no se configura un navegador del sistema, se utiliza Chromium de Playwright.
const evidenceDir = resolve(project, 'tests/evidence');
await mkdir(evidenceDir, { recursive: true });
const sourceHashes = {};
for(const file of ['public/app.js','public/sw.js','public/styles.css'])sourceHashes[file]=createHash('sha256').update(await readFile(resolve(project,file))).digest('hex');
const dataDir = await mkdtemp(resolve(tmpdir(), 'aularaiz-e2e-'));
const app = createApp({ dataDir });
const server = http.createServer(app.handler);
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  ...(executablePath ? { executablePath } : {}),
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required']
});
const context = await browser.newContext({ viewport: { width: 1440, height: 1080 } });
const page = await context.newPage();
const failures = [];
const pageErrors = [];
const requestErrors = [];
page.on('pageerror', error => pageErrors.push(error.message));
page.on('console', message => { if (message.type() === 'error' && !message.text().includes('net::ERR_INTERNET_DISCONNECTED')) requestErrors.push(message.text()); });
const checks = [];
const mark = (name, detail = '') => { checks.push({ name, passed: true, detail }); console.log(`PASS ${name}${detail ? ': ' + detail : ''}`); };
async function local(store) { return page.evaluate(async storeName => (await import('/db.js')).all(storeName), store); }
async function poll(fn, timeout = 10000) { const end = Date.now() + timeout; while (Date.now() < end) { if (await fn()) return; await new Promise(r => setTimeout(r, 80)); } throw new Error('La condición no se cumplió en el tiempo esperado.'); }
async function login(role = 'student') {
  await page.locator('#email').fill(role === 'teacher' ? 'docente@aularaiz.local' : 'alumno@aularaiz.local');
  await page.locator('#password').fill(role === 'teacher' ? 'Docente2026!' : 'Alumno2026!');
  await page.locator('#login-form').getByRole('button', { name: 'Ingresar al aula' }).click();
  await page.locator('.sidebar-user').waitFor();
}
async function api(path, options = {}, session) {
  session ||= await page.evaluate(() => JSON.parse(localStorage.getItem('aularaiz-session')));
  const response = await fetch(base + '/api' + path, { ...options, headers: { Authorization: `Bearer ${session.token}`, 'Content-Type': 'application/json', ...options.headers } });
  const result = await response.json();
  assert.ok(response.ok, `${path}: ${response.status} ${result.error || ''}`);
  return result;
}
async function nav(view) { await page.locator(`.sidebar [data-view="${view}"]`).click(); }
async function noOverflow(label) {
  const dimensions = await page.evaluate(() => ({ width: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
  assert.ok(dimensions.document <= dimensions.width + 1 && dimensions.body <= dimensions.width + 1, `${label}: overflow ${JSON.stringify(dimensions)}`);
  mark(`Sin desbordamiento ${label}`, `${dimensions.width}px`);
}
try {
  await page.goto(base);
  await page.locator('#login-form').waitFor();
  await page.screenshot({ path: resolve(evidenceDir, '01-login-desktop.png'), fullPage: true });
  await noOverflow('acceso escritorio');
  await login();
  await page.locator('h1').filter({ hasText: 'Hola' }).waitFor();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  const studentSession = await page.evaluate(() => JSON.parse(localStorage.getItem('aularaiz-session')));
  await page.locator('[data-action="download"][data-id="ciencias"]').click();
  await poll(async () => (await local('downloads')).some(item => item.course.id === 'ciencias'));
  await page.locator('.course-card').filter({ hasText: 'Ciencia y ambiente' }).getByText('Disponible sin conexión').waitFor();
  await page.screenshot({ path: resolve(evidenceDir, '02-dashboard-desktop.png'), fullPage: true, animations:'disabled', style:'#toast{visibility:hidden!important}' });
  mark('Ingreso y descarga de unidad', 'Ciencias guardada en IndexedDB y Service Worker activo');
  await context.setOffline(true);
  await page.reload();
  await page.locator('h1').filter({ hasText: 'Hola' }).waitFor();
  await page.locator('[data-action="course"][data-id="ciencias"]').click();
  await page.locator('[data-action="material"][data-id="agua-comunidad"]').click();
  await page.getByRole('dialog').getByText('El agua circula constantemente', { exact: false }).waitFor();
  await page.getByRole('button', { name: 'Marcar como completado', exact: false }).click();
  mark('Lectura sin conexión tras recarga', 'Lectura y marcado de avance desde almacenamiento local');
  await page.locator('[data-action="quiz"][data-id="quiz-ciencias"]').click();
  await page.locator('input[name="answer-0"][value="0"]').check();
  await poll(async () => (await local('drafts')).some(d => d[0] === 0));
  await page.reload();
  await page.locator('[data-action="quiz"][data-id="quiz-ciencias"]').waitFor();
  await page.locator('[data-action="quiz"][data-id="quiz-ciencias"]').click();
  assert.equal(await page.locator('input[name="answer-0"][value="0"]').isChecked(), true);
  await page.getByText('Borrador recuperado de este dispositivo.', { exact: true }).waitFor();
  mark('Borrador de cuestionario persiste', 'Selección recuperada tras recarga sin conexión');
  await page.locator('input[name="answer-1"][value="1"]').check();
  await page.locator('input[name="answer-2"][value="2"]').check();
  await page.getByRole('button', { name: 'Guardar mis respuestas' }).click();
  await poll(async () => (await local('outbox')).filter(x => x.userId === studentSession.user.id).length === 2);
  const queued = (await local('outbox')).filter(x => x.userId === studentSession.user.id);
  const pendingAttempt = queued.find(x => x.type === 'attempt');
  assert.ok(pendingAttempt);
  assert.equal((await api('/bootstrap', {}, studentSession)).attempts.length, 0);
  await page.reload();
  await page.locator('.sidebar-user').waitFor();
  const reloaded = (await local('outbox')).filter(x => x.userId === studentSession.user.id);
  assert.equal(reloaded.length, 2);
  assert.equal(reloaded.find(x => x.type === 'attempt').id, pendingAttempt.id);
  await nav('sync');
  await page.getByText('Respuesta de cuestionario', { exact: true }).waitFor();
  await page.screenshot({ path: resolve(evidenceDir, '03-offline-pending-desktop.png'), fullPage: true });
  mark('Cola offline conservada', 'Intento y avance siguen pendientes con identificadores estables tras recarga');
  await context.setOffline(false);
  await poll(async () => (await local('outbox')).filter(x => x.userId === studentSession.user.id).length === 0);
  await poll(async () => (await api('/bootstrap', {}, studentSession)).attempts.length === 1);
  let bootstrap = await api('/bootstrap', {}, studentSession);
  assert.equal(bootstrap.attempts[0].score, 3);
  assert.equal(bootstrap.attempts[0].total, 3);
  assert.equal(bootstrap.attempts[0].percentage, 100);
  assert.equal(bootstrap.progress.find(x => x.materialId === 'agua-comunidad').completed, true);
  const { userId, error, ...event } = pendingAttempt;
  const repeated = await api('/sync', { method: 'POST', body: JSON.stringify({ events: [event] }) }, studentSession);
  assert.equal(repeated.accepted[0].duplicate, true);
  assert.equal((await api('/bootstrap', {}, studentSession)).attempts.length, 1);
  await nav('sync');
  await page.getByText('Confirmado', { exact: true }).waitFor();
  mark('Sincronización y calificación reales', 'Un intento confirmado 3/3 (100%); reintento idempotente sin duplicar');
  await page.locator('[data-action="logout"]').click();
  await login('teacher');
  await page.getByRole('heading', { name: 'Espacio docente', exact: true }).waitFor();
  await nav('downloads');
  await page.getByRole('heading', { name: 'Tu biblioteca empieza aquí', exact: true }).waitFor();
  await nav('sync');
  await page.getByText('No tienes avances pendientes.', { exact: true }).waitFor();
  assert.equal(await page.locator('.results-panel tbody tr').count(), 1);
  const teacherData = await api('/bootstrap');
  assert.equal(teacherData.attempts[0].studentName, studentSession.user.name);
  assert.equal(teacherData.attempts[0].userId, studentSession.user.id);
  mark('Aislamiento de cuenta y resultados docentes', 'Docente no hereda descargas ni cola; ve el resultado del alumno con su nombre mediante permiso de docente');
  await nav('teacher');
  await page.locator('#material-title').fill('Lectura publicada durante la prueba');
  await page.locator('#material-description').fill('Material creado con la interfaz docente local.');
  await page.locator('#material-body').fill('La comunidad protege sus fuentes de agua.\n\nEsta lectura fue creada por una prueba automática del prototipo.');
  await page.locator('#material-form').getByRole('button', { name: 'Publicar material', exact: true }).click();
  await page.getByRole('cell', { name: 'Lectura publicada durante la prueba', exact: true }).waitFor();
  mark('Publicación docente de lectura', 'Material persistido desde formulario y visible en tabla del servidor');

  const videoBytes = await page.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 180;
    const ctx = canvas.getContext('2d');
    const stream = canvas.captureStream(12);
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8') ? 'video/webm;codecs=vp8' : 'video/webm';
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 150000 });
    const parts = []; recorder.ondataavailable = event => { if(event.data.size) parts.push(event.data); };
    const stopped = new Promise(resolve => { recorder.onstop = resolve; });
    recorder.start();
    for(let frame = 0; frame < 15; frame++) {
      ctx.fillStyle = '#123c34'; ctx.fillRect(0,0,320,180);
      ctx.fillStyle = '#cbe9a1'; ctx.font = 'bold 25px sans-serif'; ctx.fillText('AulaRaíz', 30, 65);
      ctx.font = '17px sans-serif'; ctx.fillText('Video educativo local', 30, 102);
      ctx.beginPath();ctx.arc(30+frame*15,140,9,0,Math.PI*2);ctx.fill();
      await new Promise(resolve => setTimeout(resolve, 90));
    }
    recorder.stop(); await stopped; stream.getTracks().forEach(track=>track.stop());
    return Array.from(new Uint8Array(await new Blob(parts, { type: 'video/webm' }).arrayBuffer()));
  });
  assert.ok(videoBytes.length > 500);
  await page.locator('#material-title').fill('Video educativo local de prueba');
  await page.locator('#material-description').fill('Video WebM real generado con MediaRecorder para comprobar reproducción offline.');
  await page.locator('#material-type').selectOption('video');
  await page.locator('#material-file').setInputFiles({ name: 'aularaiz-demo.webm', mimeType: 'video/webm', buffer: Buffer.from(videoBytes) });
  await page.locator('#material-form').getByRole('button', { name: 'Publicar material', exact: true }).click();
  await page.getByRole('cell', { name: 'Video educativo local de prueba', exact: true }).waitFor();
  mark('Publicación de video real', `${videoBytes.length} bytes WebM cargados desde el formulario docente`);
  await page.locator('#quiz-title').fill('Cuestionario creado desde la interfaz');
  await page.locator('#q0').fill('¿Qué protege las fuentes de agua de la comunidad?');
  await page.locator('#q0o0').fill('Conservar los árboles');
  await page.locator('#q0o1').fill('Contaminar los ríos');
  await page.locator('#q0o2').fill('Desperdiciar el agua');
  await page.locator('#correct-0').selectOption('0');
  await page.locator('#quiz-editor-form').getByRole('button', { name: 'Publicar cuestionario', exact: true }).click();
  await poll(async () => (await api('/bootstrap')).quizzes.some(q=>q.title==='Cuestionario creado desde la interfaz'));
  mark('Publicación docente de cuestionario', 'Pregunta con tres opciones y clave de respuesta guardada desde la interfaz');
  await page.screenshot({ path: resolve(evidenceDir, '04-teacher-desktop.png'), fullPage: true, animations:'disabled', style:'#toast{visibility:hidden!important}' });
  await page.setViewportSize({ width:390, height:844 });
  await page.evaluate(()=>window.scrollTo(0,0));
  await noOverflow('docente móvil');
  await page.screenshot({ path: resolve(evidenceDir, '05-teacher-mobile.png'), fullPage: true, animations:'disabled', style:'#toast{visibility:hidden!important}' });
  await page.locator('[data-action="menu"]').click();
  await page.locator('[data-action="logout"]').click();
  await page.screenshot({ path: resolve(evidenceDir, '06-login-mobile.png'), fullPage: true, animations:'disabled' });
  await noOverflow('acceso móvil');
  await login();
  await page.locator('h1').filter({ hasText: 'Hola' }).waitFor();
  await poll(async () => (await local('downloads')).find(item => item.userId === studentSession.user.id && item.course.id === 'ciencias')?.materials.some(m=>m.title === 'Video educativo local de prueba'));
  await page.screenshot({ path: resolve(evidenceDir, '07-dashboard-mobile.png'), fullPage: true, animations:'disabled', style:'#toast{visibility:hidden!important}' });
  await noOverflow('inicio móvil');
  const pack = (await local('downloads')).find(item=>item.userId === studentSession.user.id && item.course.id === 'ciencias');
  const video = pack.materials.find(m=>m.title === 'Video educativo local de prueba');
  assert.ok(video && pack.assets[video.id]);
  await context.setOffline(true);
  await page.reload();
  await page.locator('h1').filter({hasText:'Hola'}).waitFor();
  await page.locator('[data-action="course"][data-id="ciencias"]').click();
  await page.locator('[data-action="material"]').filter({hasText:'Abrir'}).first().waitFor();
  await page.locator(`[data-action="material"][data-id="${video.id}"]`).click();
  await page.locator('video').waitFor();
  await page.waitForFunction(() => {const video=document.querySelector('video');return video && video.readyState >= 1 && video.videoWidth === 320;});
  const videoState = await page.locator('video').evaluate(async video => { await video.play(); await new Promise(r=>setTimeout(r,300)); return {width:video.videoWidth,height:video.videoHeight,time:video.currentTime,paused:video.paused,error:video.error?.message||null,src:video.currentSrc}; });
  assert.equal(videoState.error, null); assert.equal(videoState.paused, false); assert.ok(videoState.time > 0); assert.ok(videoState.src.startsWith('blob:'));
  await page.screenshot({ path: resolve(evidenceDir, '08-video-offline-mobile.png'), fullPage: false, animations:'disabled' });
  mark('Reproducción de video sin conexión', `Blob local ${videoState.width}×${videoState.height}, reproducción avanza ${videoState.time.toFixed(2)}s`);
  await noOverflow('video móvil');
  await page.locator('[data-action="close-modal"]').click();
  await page.locator('.resource-card').filter({hasText:'Lectura publicada durante la prueba'}).getByRole('button', {name:'Abrir'}).click();
  await page.getByRole('dialog').getByText('La comunidad protege sus fuentes de agua.',{exact:false}).waitFor();
  mark('Actualización automática de materiales', 'Lectura y video nuevos disponibles en la unidad tras actualización y desconexión');
  assert.deepEqual(pageErrors, [], 'No debe haber excepciones JavaScript en navegador');
  mark('Sin excepciones JavaScript de navegador');
} catch (error) {
  failures.push({ message: error.message, stack: error.stack });
  console.error(error.stack);
  await page.screenshot({ path: resolve(evidenceDir, 'failure.png'), fullPage: true }).catch(()=>{});
} finally {
  const report = { generatedAt: new Date().toISOString(), browser: executablePath ? executablePath.replaceAll('\\', '/').split('/').at(-1) : 'Chromium (Playwright)', viewportDesktop:'1440x1080', viewportMobile:'390x844', passed: failures.length===0, checks, failures, pageErrors, consoleErrors:requestErrors, physicalMobileTest:false, isolatedTemporaryDatabase:true, sourceHashes };
  await writeFile(resolve(evidenceDir,'results.json'), JSON.stringify(report,null,2));
  await writeFile(resolve(evidenceDir,'RESULTADO_E2E.md'), `# Resultado de pruebas de navegador\n\nFecha UTC: ${report.generatedAt}\n\nEstado: ${report.passed?'APROBADO':'CON INCIDENCIAS'}\n\nNavegador local: Edge o Chrome instalado, automatizado mediante Playwright. Datos aislados en una base temporal. Vista escritorio 1440 × 1080; vista móvil emulada 390 × 844.\n\n${checks.map(c=>`- [x] ${c.name}${c.detail?': '+c.detail:''}`).join('\n')}\n\n${failures.map(f=>'- [ ] '+f.message).join('\n')}\n\nErrores JavaScript: ${pageErrors.length}. La emulación móvil no reemplaza una prueba en celular físico. La instalación real y la confianza del certificado HTTPS deben verificarse en el dispositivo antes de la exposición.\n`);
  await context.close(); await browser.close(); await new Promise(resolve=>server.close(resolve)); app.close();
  await rm(dataDir,{recursive:true,force:true});
  if(!failures.length)await rm(resolve(evidenceDir,'failure.png'),{force:true});
}
if(failures.length)process.exitCode=1;
