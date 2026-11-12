import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_USERS, selectDemoUser } from '../public/login-demo.js';

function createForm() {
  const fields = {
    email: { value: '' },
    password: { value: '' }
  };
  return {
    fields,
    elements: { namedItem(name) { return fields[name] || null; } }
  };
}

test('el correo docente se establece solo al elegir cuenta docente', () => {
  const form = createForm();
  assert.equal(form.fields.email.value, '');
  assert.equal(form.fields.password.value, '');
  assert.equal(selectDemoUser(form, 'teacher'), true);
  assert.equal(form.fields.email.value, 'docente@aularaiz.local');
  assert.equal(form.fields.password.value, DEMO_USERS.teacher.password);
});

test('elegir alumno elimina las credenciales docentes y viceversa', () => {
  const form = createForm();
  selectDemoUser(form, 'teacher');
  assert.equal(selectDemoUser(form, 'student'), true);
  assert.equal(form.fields.email.value, 'alumno@aularaiz.local');
  assert.equal(form.fields.password.value, DEMO_USERS.student.password);
  assert.equal(selectDemoUser(form, 'teacher'), true);
  assert.equal(form.fields.email.value, 'docente@aularaiz.local');
});

test('el administrador puede escribir su propia cuenta sin rellenado de demostración', () => {
  const form = createForm();
  form.fields.email.value = 'administrador@ejemplo.com';
  form.fields.password.value = 'MiClavePersonal';
  assert.equal(selectDemoUser(form, 'admin'), false);
  assert.equal(selectDemoUser(form, ''), false);
  assert.equal(form.fields.email.value, 'administrador@ejemplo.com');
  assert.equal(form.fields.password.value, 'MiClavePersonal');
});
