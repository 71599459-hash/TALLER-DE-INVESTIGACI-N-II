import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createApp } from './index.mjs';

test('API educativa: permisos, persistencia, reintentos y versiones offline', async t => {
  const dir = mkdtempSync(resolve(tmpdir(), 'aularaiz-test-'));
  const publicDir = resolve(dir, 'public');
  mkdirSync(publicDir);
  writeFileSync(resolve(publicDir, 'index.html'), '<!doctype html><title>Prueba local</title>');
  let app = createApp({ dataDir: dir, publicDir });
  const server = http.createServer((req, res) => app.handler(req, res));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    app.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const request = async (path, { token, data, method = data ? 'POST' : 'GET', headers = {} } = {}) => {
    const response = await fetch(base + path, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(data ? { 'Content-Type': 'application/json' } : {}), ...headers }, ...(data ? { body: JSON.stringify(data) } : {}) });
    const body = (response.headers.get('content-type') || '').includes('application/json') ? await response.json() : await response.text();
    return { response, body };
  };
  let studentToken, teacherToken, studentBootstrap;

  await t.test('inicio de sesión y aislamiento de claves correctas', async () => {
    assert.equal((await request('/api/health')).body.ok, true);
    assert.equal((await request('/api/bootstrap')).response.status, 401);
    assert.equal((await request('/api/login', { data: { email: 'alumno@aularaiz.local', password: 'no-es-correcta' } })).response.status, 401);
    const student = await request('/api/login', { data: { email: 'alumno@aularaiz.local', password: 'Alumno2026!' } });
    studentToken = student.body.token;
    assert.equal(student.body.user.role, 'student');
    const teacher = await request('/api/login', { data: { email: 'docente@aularaiz.local', password: 'Docente2026!' } });
    teacherToken = teacher.body.token;
    assert.equal(teacher.body.user.name, 'Roberto Alejandro Cardenas Curisinche');
    studentBootstrap = (await request('/api/bootstrap', { token: studentToken })).body;
    assert.equal(studentBootstrap.courses.length, 3);
    assert.equal(studentBootstrap.materials.length, 6);
    assert.equal(studentBootstrap.quizzes.length, 3);
    assert.equal('correctIndex' in studentBootstrap.quizzes[0].questions[0], false);
    const teacherBootstrap = (await request('/api/bootstrap', { token: teacherToken })).body;
    assert.equal(typeof teacherBootstrap.quizzes[0].questions[0].correctIndex, 'number');
    assert.equal((await request('/api/materials', { token: studentToken, data: { title: 'No permitido' } })).response.status, 403);
    assert.equal((await request('/api/export', { token: studentToken })).response.status, 403);
  });

  let oldQuiz;
  await t.test('publicar una nueva versión conserva el cuestionario descargado', async () => {
    oldQuiz = studentBootstrap.quizzes.find(q => q.id === 'quiz-ciencias');
    const updated = await request('/api/quizzes', { token: teacherToken, data: { id: oldQuiz.id, courseId: oldQuiz.courseId, title: 'Cuestionario revisado', questions: [{ prompt: 'Pregunta de la nueva versión', options: ['Uno', 'Dos'], correctIndex: 1 }] } });
    assert.equal(updated.response.status, 200);
    assert.equal(updated.body.version, 2);
    assert.equal(updated.body.questions.length, 1);
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM quiz_versions WHERE quiz_id=?').get(oldQuiz.id).n, 2);
  });

  let attemptEvent, progressEvent;
  await t.test('califica versión antigua y confirma eventos una sola vez', async () => {
    attemptEvent = { id: randomUUID(), type: 'attempt', createdAt: new Date().toISOString(), payload: { quizId: oldQuiz.id, quizVersion: oldQuiz.version, answers: [0, 1, 2] } };
    progressEvent = { id: randomUUID(), type: 'progress', payload: { materialId: 'agua-comunidad', courseId: 'ciencias', completed: true } };
    const sent = await request('/api/sync', { token: studentToken, data: { events: [attemptEvent, progressEvent] } });
    assert.equal(sent.body.rejected.length, 0);
    assert.equal(sent.body.accepted.length, 2);
    assert.equal(sent.body.accepted[0].result.score, 3);
    assert.equal(sent.body.accepted[0].result.percentage, 100);
    assert.equal(sent.body.accepted[0].result.quizVersion, 1);
    const retry = await request('/api/sync', { token: studentToken, data: { events: [attemptEvent, progressEvent] } });
    assert.equal(retry.body.accepted[0].duplicate, true);
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM attempts').get().n, 1);
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM progress').get().n, 1);
    const edited = { ...attemptEvent, payload: { ...attemptEvent.payload, answers: [2, 2, 2] } };
    const conflict = await request('/api/sync', { token: studentToken, data: { events: [edited] } });
    assert.equal(conflict.body.rejected[0].status, 409);
    assert.equal(conflict.body.accepted.length, 0);
  });

  await t.test('rechaza respuestas inválidas sin perder los otros eventos', async () => {
    const invalid = { id: randomUUID(), type: 'attempt', payload: { quizId: oldQuiz.id, quizVersion: 1, answers: [999] } };
    const sent = await request('/api/sync', { token: studentToken, data: { events: [invalid, progressEvent] } });
    assert.equal(sent.body.rejected[0].id, invalid.id);
    assert.equal(sent.body.accepted[0].id, progressEvent.id);
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM attempts').get().n, 1);
    assert.equal((await request('/api/sync', { token: teacherToken, data: { events: [] } })).response.status, 403);
  });

  await t.test('SQLite conserva registros y recibos después de reiniciar', async () => {
    app.close();
    app = createApp({ dataDir: dir, publicDir });
    const bootstrap = (await request('/api/bootstrap', { token: studentToken })).body;
    assert.equal(bootstrap.attempts.length, 1);
    assert.equal(bootstrap.progress[0].completed, true);
    const retry = await request('/api/sync', { token: studentToken, data: { events: [attemptEvent] } });
    assert.equal(retry.body.accepted[0].duplicate, true);
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM attempts').get().n, 1);
  });

  await t.test('publicación, edición y descarga autenticada por rangos', async () => {
    const uploaded = await request('/api/materials', { token: teacherToken, data: { title: 'Guía local de prueba', description: 'Archivo de prueba', courseId: 'ciencias', type: 'file', file: { name: 'guia.txt', type: 'text/plain', data: Buffer.from('educacion sin conexion').toString('base64') } } });
    assert.equal(uploaded.response.status, 201);
    assert.equal(uploaded.body.size, 22);
    assert.equal((await request(uploaded.body.assetUrl)).response.status, 401);
    const asset = await request(uploaded.body.assetUrl, { token: studentToken, headers: { Range: 'bytes=0-8' } });
    assert.equal(asset.response.status, 206);
    assert.equal(asset.body, 'educacion');
    const tail = await request(uploaded.body.assetUrl, { token: studentToken, headers: { Range: 'bytes=-8' } });
    assert.equal(tail.body, 'conexion');
    assert.equal((await request(uploaded.body.assetUrl, { token: studentToken, headers: { Range: 'bytes=999-1000' } })).response.status, 416);
    const updated = await request('/api/materials', { token: teacherToken, data: { ...uploaded.body, title: 'Guía actualizada' } });
    assert.equal(updated.body.version, 2);
    assert.equal(updated.body.assetUrl, uploaded.body.assetUrl);
    const invalidVideo = await request('/api/materials', { token: teacherToken, data: { title: 'Video inválido', courseId: 'ciencias', type: 'video', file: { name: 'incorrecto.mp4', type: 'video/mp4', data: Buffer.from('no es video').toString('base64') } } });
    assert.equal(invalidVideo.response.status, 400);
  });

  await t.test('exportación omite hashes y sesiones y está protegida', async () => {
    const exported = await request('/api/export', { token: teacherToken });
    assert.equal(exported.response.status, 200);
    assert.equal(exported.body.attempts.length, 1);
    assert.equal(JSON.stringify(exported.body).includes('password_hash'), false);
    assert.equal('sessions' in exported.body, false);
    assert.equal((await request('/api/bootstrap', { token: 'a'.repeat(64) })).response.status, 401);
  });

  await t.test('sirve aplicación con cabeceras y bloquea archivos fuera de public', async () => {
    const index = await request('/');
    assert.equal(index.response.status, 200);
    assert.equal(index.response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal((await request('/server/index.mjs')).response.status, 404);
    assert.equal((await request('/.env')).response.status, 404);
    assert.equal((await request('/api/no-existe', { token: studentToken })).response.status, 404);
  });

  await t.test('cerrar sesión revoca el token de acceso', async () => {
    const login = await request('/api/login',{data:{email:'alumno@aularaiz.local',password:'Alumno2026!'}});
    assert.equal(login.response.status,200);
    const token=login.body.token;
    assert.equal((await request('/api/bootstrap',{token})).response.status,200);
    assert.equal((await request('/api/logout',{token,method:'POST'})).response.status,200);
    assert.equal((await request('/api/bootstrap',{token})).response.status,401);
  });
});
