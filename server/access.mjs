import { randomUUID } from 'node:crypto';
import { passwordHash } from './seed.mjs';

export class AccountError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const reject = (status, message) => { throw new AccountError(status, message); };

function requiredText(value, label, maximum = 160) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maximum) {
    reject(400, `${label}: escribe un valor de hasta ${maximum} caracteres.`);
  }
  return value.trim();
}

function validEmail(value) {
  const email = requiredText(value, 'Correo', 200).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) reject(400, 'Ingresa un correo electrónico válido.');
  return email;
}

function validPassword(value) {
  if (typeof value !== 'string' || value.length < 10 || value.length > 200) {
    reject(400, 'La contraseña debe tener entre 10 y 200 caracteres.');
  }
  return value;
}

function validRole(value) {
  if (!['student', 'teacher'].includes(value)) reject(400, 'Selecciona Alumno o Docente.');
  return value;
}

const accountFields = `u.*, COALESCE(f.enabled, 1) AS access_enabled, COALESCE(f.is_admin, 0) AS access_admin`;
const joins = `FROM users u LEFT JOIN account_flags f ON f.user_id = u.id`;

export function migrateAccounts(db) {
  const existed = Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='course_enrollments'").get());
  db.exec(`
    CREATE TABLE IF NOT EXISTS account_flags (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0, 1)),
      is_admin INTEGER NOT NULL DEFAULT 0 CHECK(is_admin IN (0, 1))
    );
    CREATE TABLE IF NOT EXISTS course_enrollments (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, course_id)
    );
    CREATE INDEX IF NOT EXISTS enrollment_course ON course_enrollments(course_id);
  `);
  // Primera actualización: conservar los cursos de los alumnos existentes.
  if (!existed) {
    db.exec("INSERT OR IGNORE INTO course_enrollments(user_id, course_id) SELECT u.id, c.id FROM users u CROSS JOIN courses c WHERE u.role='student'");
  }
}

export function accountByEmail(db, email) {
  return db.prepare(`SELECT ${accountFields} ${joins} WHERE u.email = ?`).get(email);
}

export function accountByTokenHash(db, hash, now) {
  return db.prepare(`SELECT ${accountFields} ${joins} JOIN sessions s ON s.user_id = u.id WHERE s.token_hash = ? AND s.expires_at > ?`).get(hash, now);
}

export function publicAccount(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.access_admin ? 'admin' : user.role,
    isActive: Boolean(user.access_enabled)
  };
}

export function assignedCourses(db, userId) {
  return db.prepare('SELECT course_id FROM course_enrollments WHERE user_id = ? ORDER BY course_id').all(userId).map(row => row.course_id);
}

export function hasCourseAccess(db, user, courseId) {
  if (user.role !== 'student') return true;
  return Boolean(db.prepare('SELECT 1 FROM course_enrollments WHERE user_id=? AND course_id=?').get(user.id, courseId));
}

export function requireCourseAccess(db, user, courseId) {
  if (!hasCourseAccess(db, user, courseId)) reject(403, 'No tienes habilitado este curso. Consulta al administrador.');
}

export function requireAdministrator(user) {
  if (!user.access_admin) reject(403, 'Esta sección es exclusiva del administrador.');
}

export function listManagedUsers(db) {
  const users = db.prepare(`SELECT ${accountFields} ${joins} ORDER BY u.name COLLATE NOCASE, u.email`).all();
  return users.map(user => ({
    ...publicAccount(user),
    courseIds: user.role === 'student' ? assignedCourses(db, user.id) : []
  }));
}

function existingAccount(db, id) {
  const account = db.prepare(`SELECT ${accountFields} ${joins} WHERE u.id=?`).get(id);
  if (!account) reject(404, 'El usuario indicado no existe.');
  return account;
}

function uniqueEmailError(error) {
  if (String(error.message).includes('UNIQUE constraint failed: users.email')) {
    reject(409, 'Ese correo electrónico ya está registrado.');
  }
  throw error;
}

export function createManagedUser(db, body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) reject(400, 'Los datos del usuario no son válidos.');
  const name = requiredText(body.name, 'Nombre');
  const email = validEmail(body.email);
  const password = validPassword(body.password);
  const role = validRole(body.role);
  const id = randomUUID();

  try {
    db.exec('BEGIN IMMEDIATE');
    db.prepare('INSERT INTO users(id,name,email,role,password_hash) VALUES (?,?,?,?,?)').run(id, name, email, role, passwordHash(password));
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    uniqueEmailError(error);
  }
  return { ...publicAccount(existingAccount(db, id)), courseIds: [] };
}

export function updateManagedUser(db, id, changes) {
  const user = existingAccount(db, id);
  if (user.access_admin) reject(403, 'La cuenta administradora se protege de cambios desde este panel.');
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) reject(400, 'Los cambios no son válidos.');

  const allowed = new Set(['name', 'email', 'role', 'isActive', 'password']);
  if (!Object.keys(changes).length || Object.keys(changes).some(k => !allowed.has(k))) reject(400, 'No se recibieron campos válidos para actualizar.');

  const fields = [], values = [];
  if (Object.hasOwn(changes, 'name')) { fields.push('name=?'); values.push(requiredText(changes.name, 'Nombre')); }
  if (Object.hasOwn(changes, 'email')) { fields.push('email=?'); values.push(validEmail(changes.email)); }
  if (Object.hasOwn(changes, 'role')) { fields.push('role=?'); values.push(validRole(changes.role)); }
  const passwordChanged = typeof changes.password === 'string' && changes.password.length > 0;
  if (Object.hasOwn(changes, 'password') && typeof changes.password !== 'string') reject(400, 'La contraseña no es válida.');
  if (passwordChanged) { fields.push('password_hash=?'); values.push(passwordHash(validPassword(changes.password))); }
  if (Object.hasOwn(changes, 'isActive') && typeof changes.isActive !== 'boolean') reject(400, 'El estado debe ser activo o inactivo.');
  const accessChanged = Object.hasOwn(changes, 'isActive') && user.access_enabled !== Number(changes.isActive);
  const roleChanged = Object.hasOwn(changes, 'role') && user.role !== changes.role;

  try {
    db.exec('BEGIN IMMEDIATE');
    if (fields.length) db.prepare(`UPDATE users SET ${fields.join(',')} WHERE id=?`).run(...values, id);
    if (Object.hasOwn(changes, 'isActive')) {
      db.prepare('INSERT INTO account_flags(user_id,enabled,is_admin) VALUES (?,?,0) ON CONFLICT(user_id) DO UPDATE SET enabled=excluded.enabled').run(id, changes.isActive ? 1 : 0);
    }
    if (roleChanged) db.prepare('DELETE FROM course_enrollments WHERE user_id=?').run(id);
    if (passwordChanged || roleChanged || accessChanged) db.prepare('DELETE FROM sessions WHERE user_id=?').run(id);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    uniqueEmailError(error);
  }

  const updated = existingAccount(db, id);
  return { ...publicAccount(updated), courseIds: updated.role === 'student' ? assignedCourses(db, id) : [] };
}

export function setStudentCourses(db, id, courseIds) {
  const user = existingAccount(db, id);
  if (user.role !== 'student' || user.access_admin) reject(400, 'Solo se asignan cursos a cuentas de alumno.');
  if (!Array.isArray(courseIds) || courseIds.length > 100 ||
      courseIds.some(x => typeof x !== 'string') || new Set(courseIds).size !== courseIds.length) {
    reject(400, 'Selecciona una lista de cursos válida, sin duplicados.');
  }

  for (const courseId of courseIds) {
    if (!db.prepare('SELECT id FROM courses WHERE id=?').get(courseId)) reject(400, 'Se indicó un curso que no existe.');
  }

  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('DELETE FROM course_enrollments WHERE user_id=?').run(id);
    const add = db.prepare('INSERT INTO course_enrollments(user_id,course_id) VALUES (?,?)');
    for (const courseId of courseIds) add.run(id, courseId);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return { userId: id, courseIds: assignedCourses(db, id) };
}

export function provisionAdministrator(db, { name, email, password }) {
  const validatedName = requiredText(name, 'Nombre');
  const validatedEmail = validEmail(email);
  const validatedPassword = validPassword(password);
  if (accountByEmail(db, validatedEmail)) reject(409, 'El correo ya pertenece a un usuario. Utiliza otro para el administrador.');

  const id = randomUUID();
  try {
    db.exec('BEGIN IMMEDIATE');
    db.prepare('INSERT INTO users(id,name,email,role,password_hash) VALUES (?,?,?,?,?)').run(id, validatedName, validatedEmail, 'teacher', passwordHash(validatedPassword));
    db.prepare('INSERT INTO account_flags(user_id,enabled,is_admin) VALUES (?,1,1)').run(id);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    uniqueEmailError(error);
  }
  return publicAccount(existingAccount(db, id));
}
