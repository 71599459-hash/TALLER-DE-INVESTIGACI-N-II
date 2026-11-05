import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createApp } from './index.mjs';
import { provisionAdministrator } from './access.mjs';

test('administración, matrículas y compatibilidad de la base SQLite', async t => {
  const directory = mkdtempSync(resolve(tmpdir(), 'aularaiz-admin-'));
  let app = createApp({ dataDir: directory });
  const server = http.createServer((req, res) => app.handler(req, res));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    app.close();
    rmSync(directory, { recursive: true, force: true });
  });

  const request = async (path, { token, data, method } = {}) => {
    const response = await fetch(base + path, {
      method: method || (data ? 'POST' : 'GET'),
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(data ? { 'Content-Type': 'application/json' } : {})
      },
      ...(data ? { body: JSON.stringify(data) } : {})
    });
    const json = (response.headers.get('content-type') || '').includes('application/json');
    return { status: response.status, body: json ? await response.json() : await response.text() };
  };
  const login = async (email, password) => request('/api/login', { data: { email, password } });

  await t.test('los estudiantes existentes conservan sus tres cursos sin duplicarse', async () => {
    const original = app.db.prepare("SELECT COUNT(*) AS n FROM course_enrollments WHERE user_id='alumno-demo'").get().n;
    assert.equal(original, 3);
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM users').get().n, 2);
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM account_flags').get().n, 0);
  });

  const admin = provisionAdministrator(app.db, {
    name: 'Responsable del sistema',
    email: 'administracion@aularaiz.local',
    password: 'ClaveAdmin2026!Segura'
  });
  assert.equal(admin.role, 'admin');
  const adminLogin = await login(admin.email, 'ClaveAdmin2026!Segura');
  assert.equal(adminLogin.status, 200);
  assert.equal(adminLogin.body.user.role, 'admin');
  const adminToken = adminLogin.body.token;
  const demoStudent = await login('alumno@aularaiz.local', 'Alumno2026!');
  const demoTeacher = await login('docente@aularaiz.local', 'Docente2026!');
  assert.equal(demoStudent.status, 200);
  assert.equal(demoTeacher.status, 200);

  await t.test('el panel solo admite administradores y no expone hashes', async () => {
    assert.equal((await request('/api/admin/users')).status, 401);
    assert.equal((await request('/api/admin/users', { token: demoStudent.body.token })).status, 403);
    assert.equal((await request('/api/admin/users', { token: demoTeacher.body.token })).status, 403);
    const directory = await request('/api/admin/users', { token: adminToken });
    assert.equal(directory.status, 200);
    assert.equal(directory.body.users.length, 3);
    assert.equal(JSON.stringify(directory.body).includes('password_hash'), false);
    assert.equal(directory.body.users.find(u => u.id === 'alumno-demo').courseIds.length, 3);
    assert.equal(directory.body.users.find(u => u.role === 'admin').isActive, true);
    assert.equal((await request('/api/admin/users/'+admin.id, {
      token: adminToken, method: 'PATCH', data: { isActive: false }
    })).status, 403);
  });

  let newStudentId;
  await t.test('crear alumnos sin cursos y docentes con permisos limitados', async () => {
    const created = await request('/api/admin/users', {
      token: adminToken,
      data: { name:'Estudiante Nuevo', email:'nuevo@aularaiz.local', role:'student', password:'PasswordAlumno2026!' }
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.user.role, 'student');
    assert.deepEqual(created.body.user.courseIds, []);
    newStudentId = created.body.user.id;

    const duplicate = await request('/api/admin/users', {
      token: adminToken, data:{ name:'Otro', email:'nuevo@aularaiz.local', role:'student', password:'PasswordAlumno2026!' }
    });
    assert.equal(duplicate.status, 409);

    const student = await login('nuevo@aularaiz.local', 'PasswordAlumno2026!');
    assert.equal(student.status, 200);
    const empty = await request('/api/bootstrap', { token: student.body.token });
    assert.equal(empty.body.courses.length, 0);
    assert.equal(empty.body.materials.length, 0);
    assert.equal(empty.body.quizzes.length, 0);

    const teacher = await request('/api/admin/users', {
      token: adminToken,
      data: { name:'Docente Nuevo', email:'profesor@aularaiz.local', role:'teacher', password:'PasswordDocente2026!' }
    });
    assert.equal(teacher.status, 201);
    const teacherLogin = await login('profesor@aularaiz.local', 'PasswordDocente2026!');
    assert.equal(teacherLogin.status, 200);
    assert.equal((await request('/api/admin/users', { token: teacherLogin.body.token })).status, 403);
    assert.equal((await request('/api/bootstrap', { token: teacherLogin.body.token })).body.courses.length, 3);
  });

  await t.test('cursos asignados controlan catálogo, cuestionarios y eventos', async () => {
    const id = newStudentId;
    assert.equal((await request(`/api/admin/users/${id}/courses`, {
      token: demoTeacher.body.token, method:'PUT', data:{courseIds:['ciencias']}
    })).status, 403);
    assert.equal((await request(`/api/admin/users/${id}/courses`, {
      token: adminToken, method:'PUT', data:{courseIds:['no-existe']}
    })).status, 400);
    const set = await request(`/api/admin/users/${id}/courses`, {
      token:adminToken, method:'PUT', data:{courseIds:['ciencias']}
    });
    assert.equal(set.status, 200);
    assert.deepEqual(set.body.courseIds, ['ciencias']);

    const student = await login('nuevo@aularaiz.local', 'PasswordAlumno2026!');
    const data = (await request('/api/bootstrap', { token:student.body.token })).body;
    assert.deepEqual(data.courses.map(c=>c.id), ['ciencias']);
    assert.equal(data.materials.every(m=>m.courseId==='ciencias'), true);
    assert.equal(data.quizzes.every(q=>q.courseId==='ciencias'), true);
    assert.equal('correctIndex' in data.quizzes[0].questions[0], false);

    const otherMaterial = app.db.prepare("SELECT id FROM materials WHERE course_id='matematica' LIMIT 1").get();
    const rejected = await request('/api/sync', {
      token:student.body.token,
      data:{events:[{id:randomUUID(),type:'progress',payload:{materialId:otherMaterial.id,completed:true}}]}
    });
    assert.equal(rejected.status, 200);
    assert.equal(rejected.body.rejected[0].status, 403);

    const accepted = await request('/api/sync', {
      token:student.body.token,
      data:{events:[{id:randomUUID(),type:'progress',payload:{materialId:'agua-comunidad',completed:true}}]}
    });
    assert.equal(accepted.body.accepted.length, 1);
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM progress WHERE user_id=?').get(id).n,1);

    const quizDenied = await request('/api/sync', {
      token:student.body.token,
      data:{events:[{id:randomUUID(),type:'attempt',payload:{quizId:'quiz-matematica',quizVersion:1,answers:[1,2,0]}}]}
    });
    assert.equal(quizDenied.body.rejected[0].status, 403);

    const file = await request('/api/materials', {
      token:adminToken,
      data:{courseId:'matematica',title:'Documento protegido',type:'file',
        file:{name:'ejemplo.txt',type:'text/plain',data:Buffer.from('contenido reservado').toString('base64')}}
    });
    assert.equal(file.status, 201);
    assert.equal((await request(file.body.assetUrl, {token:student.body.token})).status, 403);
    assert.equal((await request(file.body.assetUrl, {token:demoTeacher.body.token})).status, 200);
  });

  await t.test('editar, bloquear y cambiar contraseñas revoca sesiones', async () => {
    const id = newStudentId;
    const student = await login('nuevo@aularaiz.local','PasswordAlumno2026!');
    const update = await request(`/api/admin/users/${id}`,{
      token:adminToken,method:'PATCH',
      data:{name:'Nuevo Nombre',email:'nuevo.nombre@aularaiz.local',isActive:false}
    });
    assert.equal(update.status, 200);
    assert.equal(update.body.user.isActive, false);
    assert.equal((await request('/api/bootstrap',{token:student.body.token})).status,401);
    assert.equal((await login('nuevo.nombre@aularaiz.local','PasswordAlumno2026!')).status,403);
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM progress WHERE user_id=?').get(id).n,1);

    const enabled = await request(`/api/admin/users/${id}`,{
      token:adminToken,method:'PATCH',
      data:{isActive:true,password:'ClaveActualizada2026!',role:'student'}
    });
    assert.equal(enabled.status, 200);
    assert.equal((await login('nuevo.nombre@aularaiz.local','PasswordAlumno2026!')).status,401);
    assert.equal((await login('nuevo.nombre@aularaiz.local','ClaveActualizada2026!')).status,200);

    const role = await request(`/api/admin/users/${id}`,{
      token:adminToken,method:'PATCH',data:{role:'teacher'}
    });
    assert.equal(role.body.user.role, 'teacher');
    assert.equal((await request(`/api/admin/users/${id}/courses`, {
      token:adminToken,method:'PUT',data:{courseIds:['ciencias']}
    })).status,400);
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM course_enrollments WHERE user_id=?').get(id).n,0);
  });

  await t.test('migración y estados sobreviven al reinicio del servidor', async () => {
    const count = app.db.prepare('SELECT COUNT(*) AS n FROM course_enrollments').get().n;
    app.close();
    app = createApp({dataDir:directory});
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM course_enrollments').get().n,count);
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM users').get().n,5);
    assert.equal((await login('administracion@aularaiz.local','ClaveAdmin2026!Segura')).body.user.role,'admin');
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM progress WHERE user_id=?').get(newStudentId).n,1);
  });
});
