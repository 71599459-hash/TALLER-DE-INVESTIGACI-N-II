import http from 'node:http';
import https from 'node:https';
import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, statSync, existsSync, unlinkSync } from 'node:fs';
import { createReadStream } from 'node:fs';
import { resolve, dirname, extname, basename, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { networkInterfaces } from 'node:os';
import { seed } from './seed.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const MAX_FILE = 20 * 1024 * 1024;
const MAX_BODY = 29 * 1024 * 1024;
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.webm': 'video/webm', '.pdf': 'application/pdf', '.txt': 'text/plain; charset=utf-8', '.woff2': 'font/woff2' };

class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const fail = (status, message) => { throw new ApiError(status, message); };
const plain = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
function text(value, label, max = 200, min = 1) {
  if (typeof value !== 'string' || value.trim().length < min || value.length > max) fail(400, `${label}: valor inválido (máximo ${max} caracteres).`);
  return value.trim();
}
function id(value, label = 'Identificador') {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(value)) fail(400, `${label} inválido.`);
  return value;
}
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (plain(value)) return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
function json(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(value));
}
async function readJson(req) {
  if (!(req.headers['content-type'] || '').startsWith('application/json')) fail(415, 'Envía los datos en formato JSON.');
  let length = 0;
  const chunks = [];
  for await (const chunk of req) {
    length += chunk.length;
    if (length > MAX_BODY) fail(413, 'El archivo supera el límite de 20 MB.');
    chunks.push(chunk);
  }
  let value;
  try { value = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { fail(400, 'El JSON recibido no es válido.'); }
  if (!plain(value)) fail(400, 'Se esperaba un objeto JSON.');
  return value;
}
function publicUser(row) { return { id: row.id, name: row.name, email: row.email, role: row.role }; }

export function createApp(options = {}) {
  const dataDir = resolve(options.dataDir || process.env.AULARAIZ_DATA_DIR || resolve(here, '../data'));
  const publicDir = resolve(options.publicDir || resolve(here, '../public'));
  const uploadDir = resolve(dataDir, 'uploads');
  const serverId = randomUUID();
  mkdirSync(uploadDir, { recursive: true });
  const db = new DatabaseSync(resolve(dataDir, 'aularaiz.sqlite'));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,role TEXT NOT NULL CHECK(role IN ('student','teacher')),password_hash TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS courses(id TEXT PRIMARY KEY,data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS materials(id TEXT PRIMARY KEY,course_id TEXT NOT NULL REFERENCES courses(id),version INTEGER NOT NULL,data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS quizzes(id TEXT PRIMARY KEY,course_id TEXT NOT NULL REFERENCES courses(id),version INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS quiz_versions(quiz_id TEXT NOT NULL REFERENCES quizzes(id),version INTEGER NOT NULL,data TEXT NOT NULL,PRIMARY KEY(quiz_id,version));
    CREATE TABLE IF NOT EXISTS attempts(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),quiz_id TEXT NOT NULL,quiz_version INTEGER NOT NULL,answers TEXT NOT NULL,result TEXT NOT NULL,submitted_at TEXT NOT NULL,FOREIGN KEY(quiz_id,quiz_version) REFERENCES quiz_versions(quiz_id,version));
    CREATE TABLE IF NOT EXISTS progress(user_id TEXT NOT NULL REFERENCES users(id),material_id TEXT NOT NULL REFERENCES materials(id),course_id TEXT NOT NULL,completed INTEGER NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(user_id,material_id));
    CREATE TABLE IF NOT EXISTS event_receipts(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),payload_hash TEXT NOT NULL,result TEXT NOT NULL,received_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS attempts_user ON attempts(user_id,submitted_at);
    CREATE INDEX IF NOT EXISTS session_expiration ON sessions(expires_at);
  `);
  if (options.seed !== false) seed(db);
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
  const failures = new Map();

  function auth(req, teacher = false) {
    const bearer = req.headers.authorization || '';
    if (!/^Bearer [a-f0-9]{64}$/.test(bearer)) fail(401, 'Inicia sesión para continuar.');
    const tokenHash = createHash('sha256').update(bearer.slice(7)).digest('hex');
    const user = db.prepare('SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires_at>?').get(tokenHash, Date.now());
    if (!user) fail(401, 'La sesión venció. Conéctate e inicia sesión nuevamente.');
    if (teacher && user.role !== 'teacher') fail(403, 'Esta acción está disponible para docentes.');
    return user;
  }
  function courseExists(courseId) {
    id(courseId, 'Curso');
    if (!db.prepare('SELECT id FROM courses WHERE id=?').get(courseId)) fail(400, 'El curso no existe.');
  }
  function processEvent(event, user) {
    if (!plain(event)) fail(400, 'Evento inválido.');
    id(event.id, 'Evento');
    if (!['attempt', 'progress'].includes(event.type) || !plain(event.payload)) fail(400, 'Tipo o contenido de evento inválido.');
    const hash = createHash('sha256').update(canonical({ type: event.type, payload: event.payload })).digest('hex');
    const old = db.prepare('SELECT * FROM event_receipts WHERE id=?').get(event.id);
    if (old) {
      if (old.user_id !== user.id || old.payload_hash !== hash) fail(409, 'Este identificador ya pertenece a otro envío. Conserva el evento original.');
      return { id: event.id, result: JSON.parse(old.result), duplicate: true };
    }
    const now = new Date().toISOString();
    let result;
    db.exec('BEGIN IMMEDIATE');
    try {
      if (event.type === 'attempt') {
        const payload = event.payload;
        id(payload.quizId, 'Cuestionario');
        if (!Number.isInteger(payload.quizVersion) || payload.quizVersion < 1) fail(400, 'La versión del cuestionario es inválida.');
        const row = db.prepare('SELECT data FROM quiz_versions WHERE quiz_id=? AND version=?').get(payload.quizId, payload.quizVersion);
        if (!row) fail(409, 'La versión del cuestionario no está disponible. El intento se conserva en el dispositivo para revisión.');
        const quiz = JSON.parse(row.data);
        if (!Array.isArray(payload.answers) || payload.answers.length !== quiz.questions.length || !payload.answers.every((answer, index) => Number.isInteger(answer) && answer >= 0 && answer < quiz.questions[index].options.length)) fail(400, 'Responde todas las preguntas con una opción válida.');
        const score = quiz.questions.reduce((n, question, index) => n + (question.correctIndex === payload.answers[index] ? 1 : 0), 0);
        result = { attemptId: event.id, quizId: quiz.id, quizVersion: quiz.version, score, total: quiz.questions.length, percentage: Math.round(score / quiz.questions.length * 100), submittedAt: now };
        db.prepare('INSERT INTO attempts(id,user_id,quiz_id,quiz_version,answers,result,submitted_at) VALUES (?,?,?,?,?,?,?)').run(event.id, user.id, quiz.id, quiz.version, JSON.stringify(payload.answers), JSON.stringify(result), now);
      } else {
        const payload = event.payload;
        id(payload.materialId, 'Material');
        const row = db.prepare('SELECT course_id FROM materials WHERE id=?').get(payload.materialId);
        if (!row) fail(409, 'El material no existe en el servidor.');
        if (typeof payload.completed !== 'boolean') fail(400, 'El avance debe indicar si el material está completado.');
        if (payload.courseId !== undefined && payload.courseId !== row.course_id) fail(400, 'El material no pertenece al curso indicado.');
        result = { materialId: payload.materialId, courseId: row.course_id, completed: payload.completed, updatedAt: now };
        db.prepare('INSERT INTO progress(user_id,material_id,course_id,completed,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(user_id,material_id) DO UPDATE SET completed=excluded.completed,updated_at=excluded.updated_at').run(user.id, payload.materialId, row.course_id, payload.completed ? 1 : 0, now);
      }
      db.prepare('INSERT INTO event_receipts(id,user_id,payload_hash,result,received_at) VALUES (?,?,?,?,?)').run(event.id, user.id, hash, JSON.stringify(result), now);
      db.exec('COMMIT');
      return { id: event.id, result, duplicate: false };
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  }

  async function handler(req, res) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; worker-src 'self'; manifest-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
    try {
      const url = new URL(req.url, 'http://localhost');
      const path = decodeURIComponent(url.pathname);
      const method = req.method;
      if (path === '/api/health' && method === 'GET') return json(res, 200, { ok: true, version: '1.1.0', serverId, serverTime: new Date().toISOString() });
      if (path === '/api/login' && method === 'POST') {
        const address = req.socket.remoteAddress || 'unknown';
        const blocked = failures.get(address);
        if (blocked && blocked.count >= 10 && blocked.until > Date.now()) fail(429, 'Demasiados intentos. Espera cinco minutos antes de volver a intentar.');
        const body = await readJson(req);
        const email = text(body.email, 'Correo', 200).toLowerCase();
        const password = text(body.password, 'Contraseña', 200);
        const user = db.prepare('SELECT * FROM users WHERE email=?').get(email);
        const [salt, hash] = (user?.password_hash || `00000000000000000000000000000000:${'0'.repeat(128)}`).split(':');
        const matches = timingSafeEqual(scryptSync(password, salt, 64), Buffer.from(hash, 'hex'));
        if (!user || !matches) {
          failures.set(address, { count: blocked && blocked.until > Date.now() ? blocked.count + 1 : 1, until: Date.now() + 300000 });
          fail(401, 'Correo o contraseña incorrectos.');
        }
        failures.delete(address);
        const token = randomBytes(32).toString('hex');
        db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES (?,?,?)').run(createHash('sha256').update(token).digest('hex'), user.id, Date.now() + SESSION_MS);
        return json(res, 200, { token, user: publicUser(user), serverId, expiresAt: new Date(Date.now() + SESSION_MS).toISOString() });
      }
      if (path === '/api/logout' && method === 'POST') {
        auth(req);
        db.prepare('DELETE FROM sessions WHERE token_hash=?').run(createHash('sha256').update(req.headers.authorization.slice(7)).digest('hex'));
        return json(res, 200, { ok: true });
      }
      if (path === '/api/bootstrap' && method === 'GET') {
        const user = auth(req);
        const courses = db.prepare('SELECT data FROM courses ORDER BY rowid').all().map(r => JSON.parse(r.data));
        const materials = db.prepare('SELECT data FROM materials ORDER BY rowid').all().map(r => JSON.parse(r.data));
        const quizzes = db.prepare('SELECT v.data FROM quizzes q JOIN quiz_versions v ON v.quiz_id=q.id AND v.version=q.version ORDER BY q.rowid').all().map(r => {
          const quiz = JSON.parse(r.data);
          if (user.role !== 'teacher') quiz.questions = quiz.questions.map(({ correctIndex, ...question }) => question);
          return quiz;
        });
        const attemptRows = user.role === 'teacher' ? db.prepare('SELECT a.*,u.name AS student_name FROM attempts a JOIN users u ON u.id=a.user_id ORDER BY a.submitted_at DESC').all() : db.prepare('SELECT a.*,u.name AS student_name FROM attempts a JOIN users u ON u.id=a.user_id WHERE a.user_id=? ORDER BY a.submitted_at DESC').all(user.id);
        const attempts = attemptRows.map(r => ({ ...JSON.parse(r.result), id: r.id, userId: r.user_id, studentName: r.student_name, answers: JSON.parse(r.answers) }));
        const progress = db.prepare('SELECT * FROM progress WHERE user_id=? ORDER BY updated_at').all(user.id).map(r => ({ materialId: r.material_id, courseId: r.course_id, completed: Boolean(r.completed), updatedAt: r.updated_at }));
        return json(res, 200, { user: publicUser(user), courses, materials, quizzes, attempts, progress, serverTime: new Date().toISOString() });
      }
      if (path === '/api/materials' && method === 'POST') {
        auth(req, true);
        const body = await readJson(req);
        courseExists(body.courseId);
        const type = body.type;
        if (!['article', 'file', 'video'].includes(type)) fail(400, 'El tipo de material no es válido.');
        const title = text(body.title, 'Título', 180);
        const description = body.description === undefined || body.description === '' ? '' : text(body.description, 'Descripción', 1000);
        const previous = body.id ? db.prepare('SELECT * FROM materials WHERE id=?').get(id(body.id)) : null;
        if (body.id && !previous) fail(404, 'El material que intentas editar no existe.');
        const old = previous ? JSON.parse(previous.data) : null;
        let asset = { assetUrl: null, filename: null, size: 0, mimeType: 'text/plain' };
        let materialBody = '';
        let writtenFile;
        if (type === 'article') {
          materialBody = text(body.body, 'Contenido', 100000);
          asset.size = Buffer.byteLength(materialBody);
        } else if (body.file) {
          if (!plain(body.file)) fail(400, 'Archivo inválido.');
          const originalName = text(body.file.name, 'Nombre del archivo', 180);
          const mimeType = text(body.file.type, 'Tipo del archivo', 100);
          if (typeof body.file.data !== 'string' || body.file.data.length > Math.ceil(MAX_FILE / 3) * 4 + 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(body.file.data)) fail(400, 'El archivo debe estar codificado en base64.');
          const bytes = Buffer.from(body.file.data, 'base64');
          if (!bytes.length || bytes.length > MAX_FILE) fail(413, 'El archivo debe tener entre 1 byte y 20 MB.');
          const allowed = { 'application/pdf': '.pdf', 'text/plain': '.txt', 'image/png': '.png', 'image/jpeg': '.jpg', 'video/mp4': '.mp4', 'video/webm': '.webm' };
          if (!allowed[mimeType] || (type === 'video' && !mimeType.startsWith('video/')) || (type === 'file' && mimeType.startsWith('video/'))) fail(400, 'Formatos permitidos: PDF, TXT, PNG, JPG y videos MP4 o WebM.');
          if (mimeType === 'video/mp4' && bytes.subarray(4, 8).toString() !== 'ftyp') fail(400, 'El archivo no tiene una cabecera MP4 válida.');
          if (mimeType === 'video/webm' && bytes.subarray(0, 4).toString('hex') !== '1a45dfa3') fail(400, 'El archivo no tiene una cabecera WebM válida.');
          const filename = `${randomUUID()}${allowed[mimeType]}`;
          writtenFile = resolve(uploadDir, filename);
          writeFileSync(writtenFile, bytes, { flag: 'wx' });
          asset = { assetUrl: `/api/assets/${filename}`, filename: originalName, size: bytes.length, mimeType };
        } else if (old && old.type === type && old.assetUrl) {
          asset = { assetUrl: old.assetUrl, filename: old.filename, size: old.size, mimeType: old.mimeType };
        } else fail(400, 'Selecciona un archivo antes de publicar.');
        const material = { id: old?.id || randomUUID(), courseId: body.courseId, title, description, type, body: materialBody, version: old ? old.version + 1 : 1, ...asset, updatedAt: new Date().toISOString() };
        try { db.prepare('INSERT INTO materials(id,course_id,version,data) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET course_id=excluded.course_id,version=excluded.version,data=excluded.data').run(material.id, material.courseId, material.version, JSON.stringify(material)); }
        catch (err) { if (writtenFile) unlinkSync(writtenFile); throw err; }
        return json(res, previous ? 200 : 201, material);
      }
      if (path === '/api/quizzes' && method === 'POST') {
        auth(req, true);
        const body = await readJson(req);
        courseExists(body.courseId);
        const title = text(body.title, 'Título', 180);
        if (!Array.isArray(body.questions) || body.questions.length < 1 || body.questions.length > 30) fail(400, 'Incluye entre 1 y 30 preguntas.');
        const questions = body.questions.map(q => {
          if (!plain(q) || !Array.isArray(q.options) || q.options.length < 2 || q.options.length > 6 || !Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex >= q.options.length) fail(400, 'Cada pregunta necesita de 2 a 6 opciones y una respuesta correcta.');
          return { prompt: text(q.prompt, 'Pregunta', 1000), options: q.options.map(o => text(o, 'Opción', 500)), correctIndex: q.correctIndex };
        });
        const old = body.id ? db.prepare('SELECT * FROM quizzes WHERE id=?').get(id(body.id)) : null;
        if (body.id && !old) fail(404, 'El cuestionario que intentas editar no existe.');
        const quiz = { id: old?.id || randomUUID(), courseId: body.courseId, title, version: old ? old.version + 1 : 1, questions, updatedAt: new Date().toISOString() };
        db.exec('BEGIN IMMEDIATE');
        try {
          db.prepare('INSERT INTO quizzes(id,course_id,version) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET course_id=excluded.course_id,version=excluded.version').run(quiz.id, quiz.courseId, quiz.version);
          db.prepare('INSERT INTO quiz_versions(quiz_id,version,data) VALUES (?,?,?)').run(quiz.id, quiz.version, JSON.stringify(quiz));
          db.exec('COMMIT');
        } catch (error) { db.exec('ROLLBACK'); throw error; }
        return json(res, old ? 200 : 201, quiz);
      }
      if (path === '/api/sync' && method === 'POST') {
        const user = auth(req);
        if (user.role !== 'student') fail(403, 'Los avances se registran desde el perfil de estudiante.');
        const body = await readJson(req);
        if (!Array.isArray(body.events) || body.events.length > 100) fail(400, 'Envía un máximo de 100 eventos por sincronización.');
        const accepted = [], rejected = [];
        for (const event of body.events) {
          try { accepted.push(processEvent(event, user)); }
          catch (error) {
            if (!(error instanceof ApiError)) throw error;
            rejected.push({ id: typeof event?.id === 'string' ? event.id : null, reason: error.message, status: error.status });
          }
        }
        return json(res, 200, { accepted, rejected, serverTime: new Date().toISOString() });
      }
      if (path.startsWith('/api/assets/') && (method === 'GET' || method === 'HEAD')) {
        auth(req);
        const filename = path.slice('/api/assets/'.length);
        if (!/^[a-f0-9-]{36}\.(pdf|txt|png|jpg|mp4|webm)$/.test(filename)) fail(404, 'Archivo no encontrado.');
        const fullPath = resolve(uploadDir, filename);
        if (!existsSync(fullPath)) fail(404, 'Archivo no encontrado.');
        const size = statSync(fullPath).size;
        const mime = MIME[extname(filename)] || 'application/octet-stream';
        const headers = { 'Content-Type': mime, 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, max-age=3600' };
        if (req.headers.range) {
          const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
          let start, end;
          if (range && (range[1] || range[2])) {
            if (!range[1]) { start = Math.max(0, size - Number(range[2])); end = size - 1; }
            else { start = Number(range[1]); end = range[2] ? Math.min(Number(range[2]), size - 1) : size - 1; }
          }
          if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || start > end) { res.writeHead(416, { ...headers, 'Content-Range': `bytes */${size}` }); return res.end(); }
          res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1 });
          if (method === 'HEAD') return res.end();
          createReadStream(fullPath, { start, end }).pipe(res); return;
        }
        res.writeHead(200, { ...headers, 'Content-Length': size });
        if (method === 'HEAD') return res.end();
        createReadStream(fullPath).pipe(res); return;
      }
      if (path === '/api/export' && method === 'GET') {
        auth(req, true);
        const backup = { schemaVersion: 1, exportedAt: new Date().toISOString(), users: db.prepare('SELECT id,name,email,role FROM users').all(), courses: db.prepare('SELECT data FROM courses').all().map(r => JSON.parse(r.data)), materials: db.prepare('SELECT data FROM materials').all().map(r => JSON.parse(r.data)), quizVersions: db.prepare('SELECT data FROM quiz_versions').all().map(r => JSON.parse(r.data)), attempts: db.prepare('SELECT * FROM attempts').all(), progress: db.prepare('SELECT * FROM progress').all() };
        res.setHeader('Content-Disposition', 'attachment; filename="aularaiz-registros.json"');
        return json(res, 200, backup);
      }
      if (path.startsWith('/api/')) fail(404, 'La ruta solicitada no existe.');
      if (!['GET', 'HEAD'].includes(method)) fail(405, 'Método no permitido.');
      const requested = path === '/' ? 'index.html' : path.replace(/^\/+/, '');
      const fullPath = resolve(publicDir, requested);
      if (!fullPath.startsWith(publicDir + sep) || requested.split(/[\\/]/).some(p => p.startsWith('.')) || !existsSync(fullPath) || !statSync(fullPath).isFile()) fail(404, 'Página no encontrada.');
      res.writeHead(200, { 'Content-Type': MIME[extname(fullPath)] || 'application/octet-stream', 'Cache-Control': 'no-cache', ...(basename(fullPath) === 'sw.js' ? { 'Service-Worker-Allowed': '/' } : {}) });
      if (method === 'HEAD') return res.end();
      createReadStream(fullPath).pipe(res);
    } catch (error) {
      if (res.headersSent) { res.end(); return; }
      const status = error instanceof ApiError ? error.status : error instanceof URIError ? 400 : 500;
      if (status === 500) console.error('[AulaRaíz]', error.message);
      json(res, status, { error: status === 500 ? 'No se pudo completar la operación. Los datos pendientes se conservarán para reintentar.' : status === 400 && error instanceof URIError ? 'Dirección inválida.' : error.message });
    }
  }
  return { handler, db, dataDir, close: () => db.close() };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const app = createApp();
  const hasTls = Boolean(process.env.HTTPS_CERT && process.env.HTTPS_KEY);
  const port = Number(process.env.PORT || (hasTls ? 4174 : 4173));
  const server = hasTls ? https.createServer({ cert: readFileSync(process.env.HTTPS_CERT), key: readFileSync(process.env.HTTPS_KEY) }, app.handler) : http.createServer(app.handler);
  server.requestTimeout = 60000;
  server.listen(port, '0.0.0.0', () => {
    const protocol = hasTls ? 'https' : 'http';
    console.log(`\nAulaRaíz local · ${protocol}://localhost:${port}\nDatos: ${app.dataDir}`);
    for (const interfaces of Object.values(networkInterfaces())) for (const info of interfaces || []) if (info.family === 'IPv4' && !info.internal) console.log(`Red local: ${protocol}://${info.address}:${port}`);
    if (!hasTls) console.log('Instalación PWA en esta PC: abre localhost en Edge o Chrome. Celular requiere HTTPS confiable.');
    console.log('Detener: Ctrl+C\n');
  });
  server.on('error', error => { console.error(`No se pudo iniciar AulaRaíz: ${error.message}`); app.close(); process.exitCode = 1; });
  const stop = () => server.close(() => { app.close(); process.exit(0); });
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
}
