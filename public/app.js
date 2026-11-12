import * as db from './db.js';
import {
  adminView,
  adminEditForm,
  adminCoursesForm,
  adminResetPasswordForm,
  adminOwnPasswordForm
} from './admin.js';
import { clearSession, readSession, saveSession, canResumeOfflineSession } from './session.js';

const root = document.querySelector('#app');
const state = {
  session: null,
  data: null,
  downloads: [],
  outbox: [],
  view: 'home',
  courseId: null,
  connected: navigator.onLine,
  syncing: false,
  downloading: null,
  search: '',
  modal: null,
  installPrompt: null,
  lastSync: null,
  notice: '',
  swReady: false,
  syncError: '',
  adminUsers: []
};
const esc = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
const uid = () => state.session?.user.id;
const key = (value) => `${uid()}:${value}`;
const date = (value) =>
  value
    ? new Intl.DateTimeFormat('es-PE', { dateStyle: 'short', timeStyle: 'short' }).format(
        new Date(value)
      )
    : 'Todavía no realizada';
const size = (n) =>
  n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.ceil(n / 1024))} KB`;
const icons = {
  home: 'M3 11 12 3l9 8v10h-6v-7H9v7H3Z',
  book: 'M12 6C8 3 4 3 2 4v15c3-1 7-1 10 2 3-3 7-3 10-2V4c-3-1-7-1-10 2Zm0 0v15',
  download: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
  sync: 'M20 7a9 9 0 0 0-15-2L2 8m0-6v6h6m-4 9a9 9 0 0 0 15 2l3-3m0 6v-6h-6',
  teacher: 'M3 4h18v13H3ZM8 21l4-4 4 4M7 8h10M7 12h5',
  help: 'M9 8a3 3 0 1 1 5 2c-2 1-2 2-2 3m0 4h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
  arrow: 'M5 12h14m-6-6 6 6-6 6',
  check: 'm5 12 4 4L20 5',
  wifi: 'M2 8a17 17 0 0 1 20 0M5 12a12 12 0 0 1 14 0m-10 4a5 5 0 0 1 6 0m-3 4h.01',
  cloud: 'M7 18a6 6 0 0 1-1-12 7 7 0 0 1 13 3 5 5 0 0 1-1 9m-6-6v9m-3-3 3 3 3-3',
  logout: 'M9 4H3v16h6m5-13 5 5-5 5m-7-5h12',
  menu: 'M3 6h18M3 12h18M3 18h18',
  close: 'm6 6 12 12M6 18 18 6',
  play: 'm9 5 12 7-12 7Z',
  file: 'M5 2h9l5 5v15H5Zm9 0v6h5M8 12h8M8 16h8',
  clock: 'M12 7v6l4 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
  plus: 'M12 4v16M4 12h16',
  search: 'M21 21l-6-6M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z',
  leaf: 'M20 3C6 1 1 12 8 17c7 5 14-4 12-14ZM6 21 16 9',
  shield: 'm12 2 9 4v6c0 6-9 10-9 10S3 18 3 12V6Z',
  trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7'
};
const icon = (name, cls = '') =>
  `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${icons[name] || icons.book}"/></svg>`;
function toast(message) {
  const el = document.querySelector('#toast');
  el.textContent = message;
  el.classList.add('visible');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('visible'), 4500);
}
async function api(path, options = {}) {
  if (!navigator.onLine) {
    state.connected = false;
    throw new Error('Sin conexión. Tus datos permanecen guardados en este dispositivo.');
  }
  let response;
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${state.session?.token || ''}`,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers
      },
      signal: AbortSignal.timeout(15000),
      cache: 'no-store'
    });
  } catch {
    state.connected = false;
    throw new Error('No se pudo contactar al servidor local. Puedes continuar con tus descargas.');
  }
  state.connected = true;
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    if (response.status === 401)
      state.notice =
        'Tu sesión necesita renovarse. Tus pendientes siguen guardados; vuelve a ingresar con la misma cuenta.';
    const error = new Error(body.error || `Error ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return options.blob ? response.blob() : response.json();
}
async function loadLocal() {
  const allowed =
    state.session?.user.role === 'student' && state.data
      ? new Set(state.data.courses.map((course) => course.id))
      : null;
  state.downloads = (await db.all('downloads')).filter(
    (item) => item.userId === uid() && (!allowed || allowed.has(item.course.id))
  );
  state.outbox = (await db.all('outbox')).filter((item) => item.userId === uid());
  state.lastSync = await db.get('kv', key('lastSync'));
}
async function loadAdministration() {
  if (state.session?.user.role !== 'admin') return;
  const result = await api('/admin/users');
  state.adminUsers = result.users;
}
async function refresh() {
  const data = await api('/bootstrap');
  await db.put('kv', key('snapshot'), data);
  state.data = data;
  if (state.session?.user.role === 'admin') await loadAdministration();
}
function downloaded(courseId) {
  return state.downloads.find((d) => d.course.id === courseId);
}
function offline() {
  return !navigator.onLine || !state.connected;
}
function courseData(courseId) {
  const local = downloaded(courseId);
  return offline()
    ? local || { materials: [], quizzes: [] }
    : {
        materials: state.data.materials.filter((x) => x.courseId === courseId),
        quizzes: state.data.quizzes.filter((x) => x.courseId === courseId)
      };
}
function hasUpdate(pack) {
  return (
    pack.materials.some((m) => state.data.materials.find((x) => x.id === m.id)?.version !== m.version) ||
    pack.quizzes.some((q) => state.data.quizzes.find((x) => x.id === q.id)?.version !== q.version) ||
    state.data.materials.filter((x) => x.courseId === pack.course.id).length !== pack.materials.length ||
    state.data.quizzes.filter((x) => x.courseId === pack.course.id).length !== pack.quizzes.length
  );
}
function complete(materialId) {
  const events = state.outbox.filter(
    (x) => x.type === 'progress' && x.payload.materialId === materialId
  );
  return events.length
    ? events.at(-1).payload.completed
    : state.data.progress.some((x) => x.materialId === materialId && x.completed);
}
function percent(courseId) {
  const materials = courseData(courseId).materials;
  return materials.length
    ? Math.round((100 * materials.filter((m) => complete(m.id)).length) / materials.length)
    : 0;
}

function login() {
  root.innerHTML = `<div class="login-screen"><section class="login-story"><div class="brand">${icon('leaf')}<span>AulaRaíz<span class="brand-dot">.</span></span></div><div class="login-story-content"><span class="hero-kicker">APRENDE AUN SIN CONEXIÓN</span><h1>Tus clases, incluso sin conexión.</h1><p>Descarga los materiales y continúa trabajando desde tu dispositivo, incluso cuando no tengas señal.</p><div class="login-features"><span>${icon('download')} Descarga tus contenidos</span><span>${icon('book')} Aprende sin conexión</span><span>${icon('sync')} Sincroniza al volver</span></div></div><p class="login-footnote">AulaRaíz · Versión de demostración</p></section><section class="login-card"><span class="eyebrow">BIENVENIDO A TU AULA</span><h2>Ingresa a tu aula.</h2><p class="subtitle">Ingresa a tu espacio de aprendizaje local.</p><form id="login-form"><div class="form-field"><label for="email">Correo electrónico</label><input id="email" name="email" type="email" autocomplete="username" required placeholder="correo@ejemplo.com"></div><div class="form-field"><label for="password">Contraseña</label><input id="password" name="password" type="password" autocomplete="current-password" required ></div><p id="login-error" class="form-error" role="alert"></p><button class="button button-primary" type="submit">Ingresar al aula ${icon('arrow')}</button></form><div class="demo-accounts"><p><strong>Cuentas para la demostración</strong></p><button class="button button-secondary" data-action="demo-student">${icon('book')} Estudiante</button> <button class="button button-secondary" data-action="demo-teacher">${icon('teacher')} Docente</button><p class="small">Datos de ejemplo. El primer ingreso necesita conexión al servidor local.</p></div><div class="login-security">${icon('shield')} Aplicación local · Tus contenidos en tu dispositivo</div></section></div>`;
}
function header(title, subtitle, action = '') {
  return `<div class="page-header"><div><span class="eyebrow">TU ESPACIO DE APRENDIZAJE</span><h1>${title}</h1><p class="subtitle">${subtitle}</p></div>${action}</div>`;
}
function art(course, small = false) {
  const index = state.data.courses.findIndex((c) => c.id === course.id) % 3;
  const shapes = [
    `<path d="M64 95c0-32 27-54 52-49 20-23 58-8 58 21 38 4 41 49 9 62H89c-18 0-25-17-25-34Z" fill="#4b8972"/><path d="M132 145V77m0 33-24-18m24 5 22-15" stroke="#183f34" stroke-width="5" stroke-linecap="round"/><path d="M65 146h130" stroke="#183f34" stroke-width="3"/><circle cx="207" cy="42" r="17" fill="#f7da8c"/>`,
    `<rect x="67" y="49" width="108" height="90" rx="7" fill="#faf3dd" stroke="#957552" stroke-width="3"/><path d="M81 68h80M81 84h49M81 100h65M81 116h28" stroke="#aa8760" stroke-width="3"/><path d="m168 109 20-52 13 5-20 52-14 13Z" fill="#d39162" stroke="#957552" stroke-width="3"/><circle cx="55" cy="47" r="10" fill="#d8af6f"/>`,
    `<path d="m134 33 59 105H75Z" fill="#b0a4ce" stroke="#6c5d91" stroke-width="3"/><circle cx="87" cy="69" r="27" fill="#e4ddf1" stroke="#6c5d91" stroke-width="3"/><rect x="145" y="97" width="52" height="50" rx="5" fill="#e9d191" stroke="#907b42" stroke-width="3"/><path d="M122 126h25m-12-12v25" stroke="#65527e" stroke-width="3"/>`
  ];
  return `<div class="course-art ${['mint', 'sand', 'lilac'][index]} ${small ? 'small-art' : ''}"><svg viewBox="0 0 270 170" fill="none" aria-hidden="true"><circle cx="234" cy="150" r="60" fill="white" opacity=".25"/>${shapes[index]}</svg><span class="art-label">${esc(course.subject || ['CIENCIA Y AMBIENTE', 'COMUNICACIÓN', 'MATEMÁTICA'][index])}</span></div>`;
}
function courseCard(course) {
  const pack = downloaded(course.id),
    p = percent(course.id);
  const count = state.data.materials.filter((m) => m.courseId === course.id).length;
  return `<article class="course-card">${art(course)}<div class="course-body"><div class="course-meta"><span>${esc(course.level || 'Secundaria')}</span><span>${count} materiales</span></div><h3>${esc(course.title)}</h3><p>${esc(course.description)}</p><div class="course-meta"><span>${p}% completado</span>${pack ? `<span class="badge ${hasUpdate(pack) ? 'badge-amber' : 'badge-green'}">${hasUpdate(pack) ? 'Actualización disponible' : 'Disponible sin conexión'}</span>` : '<span class="badge badge-gray">Por descargar</span>'}</div><div class="progress-bar"><div class="progress-fill" style="width:${p}%"></div></div><div class="card-actions"><button class="button button-ghost" data-action="course" data-id="${esc(course.id)}">Explorar unidad ${icon('arrow')}</button><button class="icon-button" title="${pack ? 'Actualizar' : 'Descargar'} unidad" aria-label="${pack ? 'Actualizar' : 'Descargar'} ${esc(course.title)}" data-action="download" data-id="${esc(course.id)}" ${state.downloading || offline() ? 'disabled' : ''}>${icon(state.downloading === course.id ? 'clock' : pack ? 'check' : 'download')}</button></div></div></article>`;
}
function hero() {
  return `<section class="hero"><div class="hero-copy"><span class="hero-kicker">CONTENIDOS PARA ESTUDIAR SIN CONEXIÓN</span><h2>Tus materiales de clase,<br>con y sin internet.</h2><p>Descarga una unidad mientras tengas conexión.<br>Después podrás consultar y responder sin señal.</p><button class="button button-primary" data-action="nav" data-view="courses">Explorar mis cursos ${icon('arrow')}</button></div><div class="hero-illustration" aria-hidden="true"><svg viewBox="0 0 340 240" fill="none"><circle cx="179" cy="121" r="99" fill="#d9e9ce"/><path d="m67 187 81-31 106 27-83 34Z" fill="#8ca389"/><path d="M91 67c36-14 61-10 82 11 27-19 51-25 78-14v116c-26-10-51-2-78 18-23-20-49-26-82-14Z" fill="#fffdf4" stroke="#416954" stroke-width="3"/><path d="M173 78v120M106 94c17-4 31-1 49 7m-49 10c17-4 31-1 49 7m-49 10c17-4 31-1 49 7m34-40c16-9 32-12 47-9m-47 25c16-9 32-12 47-9m-47 25c16-9 32-12 47-9" stroke="#95b39b" stroke-width="3"/><circle cx="260" cy="55" r="28" fill="#f0d58b"/><path d="m248 55 8 8 16-17" stroke="#5f6b3b" stroke-width="4" stroke-linecap="round"/><path d="M55 146c-29-25-24-46-18-51 21 4 32 20 18 51Zm0 0c0-34 18-48 31-43 0 23-7 38-31 43Z" fill="#719475"/><path d="M55 148v29" stroke="#416954" stroke-width="3"/><circle cx="290" cy="163" r="5" fill="#83a488"/><circle cx="73" cy="47" r="5" fill="#83a488"/></svg></div></section>`;
}
function stats() {
  const attempts = state.data.attempts || [];
  return `<div class="stats">${[
    ['book', state.data.courses.length, 'Cursos disponibles'],
    ['download', state.downloads.length, 'Unidades sin conexión'],
    ['check', attempts.length, 'Cuestionarios enviados'],
    ['sync', state.outbox.length, 'Avances pendientes']
  ]
    .map(
      ([i, n, label]) =>
        `<div class="stat-card"><span class="stat-icon">${icon(i)}</span><div><span class="stat-value">${n}</span><span class="stat-label">${label}</span></div></div>`
    )
    .join('')}</div>`;
}
function home() {
  const name = state.session.user.name.split(' ')[0];
  return `${header(`¡Hola, ${esc(name)}! <span class="greeting-mark">✦</span>`, 'Elige el curso que vas a continuar hoy.')}${hero()}${stats()}<div class="section-header"><div><h2>Continúa tu aprendizaje</h2><p>Revisa tus cursos y continúa tus actividades.</p></div><button class="button button-ghost" data-action="nav" data-view="courses">Ver todos ${icon('arrow')}</button></div><div class="grid-courses">${state.data.courses.map(courseCard).join('')}</div><div class="split-grid bottom-panels"><section class="panel"><div class="panel-title">${icon('cloud')} Tu aula también funciona sin internet</div><p>Descarga primero una unidad. Podrás leer, ver los videos descargados y responder actividades. Tus avances se enviarán cuando el servidor vuelva a estar disponible.</p><button class="button button-ghost" data-action="nav" data-view="downloads">Administrar descargas ${icon('arrow')}</button></section><section class="panel"><div class="panel-title">${icon('sync')} Todo a su tiempo</div><p>${state.outbox.length ? `Tienes ${state.outbox.length} avance(s) guardado(s) en este dispositivo, pendientes de confirmar.` : 'No tienes avances pendientes de enviar. Tu siguiente paso empieza en un curso.'}</p><span class="small">Última sincronización: ${date(state.lastSync)}</span></section></div>`;
}
function courses() {
  const query = state.search.toLocaleLowerCase('es');
  const list = state.data.courses.filter((c) =>
    (c.title + ' ' + c.description + ' ' + c.subject).toLocaleLowerCase('es').includes(query)
  );
  return `${header('Mis cursos', 'Unidades pensadas para aprender, estés donde estés.')}<div class="toolbar"><label class="search">${icon('search')}<input id="course-search" type="search" placeholder="Buscar un curso o tema…" value="${esc(state.search)}" aria-label="Buscar cursos"></label><span class="small">${list.length} cursos disponibles</span></div><div class="grid-courses">${list.map(courseCard).join('')}</div>${!list.length ? '<div class="empty-state">No encontramos cursos con ese nombre.</div>' : ''}`;
}
function resourceRow(m) {
  return `<article class="resource-card"><span class="resource-icon">${icon(m.type === 'video' ? 'play' : m.type === 'article' ? 'book' : 'file')}</span><div class="resource-info"><div class="course-meta"><span class="tag">${m.type === 'article' ? 'LECTURA' : m.type === 'video' ? 'VIDEO' : 'ARCHIVO'}</span><span>Versión ${m.version}${m.size ? ' · ' + size(m.size) : ''}</span></div><h3>${esc(m.title)}</h3><p>${esc(m.description)}</p></div><div class="resource-actions">${complete(m.id) ? '<span class="badge badge-green">Completado</span>' : ''}<button class="button button-secondary" data-action="material" data-id="${esc(m.id)}">${m.type === 'video' ? 'Ver video' : 'Abrir'} ${icon('arrow')}</button></div></article>`;
}
function courseDetail() {
  const course = state.data.courses.find((c) => c.id === state.courseId);
  if (!course) return courses();
  const content = courseData(course.id),
    pack = downloaded(course.id);
  return `<button class="button button-ghost back-button" data-action="nav" data-view="courses">← Todos los cursos</button>${header(esc(course.title), esc(course.description), `<button class="button button-primary" data-action="download" data-id="${esc(course.id)}" ${offline() || state.downloading ? 'disabled' : ''}>${icon('download')} ${state.downloading === course.id ? 'Descargando…' : pack ? 'Actualizar descarga' : 'Descargar unidad'}</button>`)}${offline() && !pack ? '<div class="notice">Esta unidad aún no está descargada. Conecta con el servidor para descargarla y usarla sin conexión.</div>' : `<div class="notice">${icon(pack ? 'check' : 'download')} ${pack ? 'Unidad guardada en este dispositivo. Descargada: ' + date(pack.downloadedAt) : 'Descarga la unidad completa para acceder sin conexión a sus materiales y cuestionarios.'}</div><div class="section-header"><h2>Materiales de la unidad</h2><span class="small">${content.materials.length} recursos</span></div><div class="resource-list">${content.materials.map(resourceRow).join('')}</div><div class="section-header"><h2>Pon a prueba lo aprendido</h2><span class="small">${content.quizzes.length} actividades</span></div>${content.quizzes.map((q) => `<article class="resource-card"><span class="resource-icon quiz-icon">${icon('teacher')}</span><div class="resource-info"><span class="tag">CUESTIONARIO · VERSIÓN ${q.version}</span><h3>${esc(q.title)}</h3><p>${q.questions.length} preguntas · Guarda tu avance automáticamente en este dispositivo.</p></div><button class="button button-primary" data-action="quiz" data-id="${esc(q.id)}">Resolver ${icon('arrow')}</button></article>`).join('')}`}`;
}
function downloadsView() {
  return `${header('Mis descargas', 'Materiales guardados en este equipo.')}<div class="notice">${icon('shield')} Las descargas pertenecen a esta cuenta y a este navegador. Evita borrar los datos del sitio si tienes avances pendientes.</div>${state.downloads.length ? state.downloads.map((pack) => `<article class="resource-card"><span class="resource-icon">${icon('download')}</span><div class="resource-info"><h3>${esc(pack.course.title)}</h3><p>${pack.materials.length} materiales · ${pack.quizzes.length} cuestionarios · ${size(pack.bytes || 0)}</p><span class="small">Descargada el ${date(pack.downloadedAt)}</span></div><div class="resource-actions"><span class="badge ${hasUpdate(pack) ? 'badge-amber' : 'badge-green'}">${hasUpdate(pack) ? 'Hay una nueva versión' : 'Lista sin conexión'}</span><button class="button button-secondary" data-action="course" data-id="${esc(pack.course.id)}">Abrir</button><button class="icon-button" data-action="remove-download" data-id="${esc(pack.course.id)}" title="Eliminar descarga" aria-label="Eliminar descarga de ${esc(pack.course.title)}">${icon('trash')}</button></div></article>`).join('') : `<div class="empty-state">${icon('download')}<h2>Tu biblioteca empieza aquí</h2><p>Descarga una unidad para leer y resolver sus actividades sin conexión.</p><button class="button button-primary" data-action="nav" data-view="courses">Explorar cursos ${icon('arrow')}</button></div>`}<section class="panel storage-panel"><h3>Espacio en el dispositivo</h3><p id="storage-info">Consultando almacenamiento…</p><button class="button button-secondary" data-action="persist">Solicitar conservación de descargas</button><p class="small">El navegador decide si concede almacenamiento persistente. Mantén también el respaldo del servidor.</p></section>`;
}
function syncView() {
  const attempts = state.data.attempts || [];
  return `${header('Centro de sincronización', 'Revisa las respuestas enviadas y los avances que faltan.', `<button class="button button-primary" data-action="sync" ${state.syncing || !navigator.onLine ? 'disabled' : ''}>${icon('sync')} ${state.syncing ? 'Sincronizando…' : 'Sincronizar ahora'}</button>`)}${state.syncError ? `<div class="notice warning" role="alert">Último intento: ${esc(state.syncError)}. Los datos pendientes siguen guardados en este dispositivo.</div>` : ''}<div class="stats sync-stats"><div class="stat-card"><span class="stat-icon">${icon('sync')}</span><div><span class="stat-value">${state.outbox.length}</span><span class="stat-label">Eventos pendientes</span></div></div><div class="stat-card"><span class="stat-icon">${icon('check')}</span><div><span class="stat-value">${attempts.length}</span><span class="stat-label">Intentos confirmados</span></div></div><div class="stat-card"><span class="stat-icon">${icon('clock')}</span><div><span class="stat-label">Última sincronización</span><strong>${date(state.lastSync)}</strong></div></div></div><section class="panel"><h2>Guardado en este dispositivo</h2><p>Una respuesta aparece como enviada únicamente después de que el servidor la confirma. Si se interrumpe el envío, se reintenta con el mismo identificador para evitar duplicados.</p>${state.outbox.length ? `<div class="activity-list">${state.outbox.map((e) => `<div class="event-row"><span class="resource-icon">${icon(e.type === 'attempt' ? 'teacher' : 'book')}</span><div><strong>${e.type === 'attempt' ? 'Respuesta de cuestionario' : 'Material completado'}</strong><p class="small">${date(e.createdAt)} · ${esc(e.id.slice(0, 8))}</p>${e.error ? `<p class="form-error">${esc(e.error)}. El evento se conserva para revisión.</p>` : ''}</div><span class="badge badge-amber">Pendiente</span></div>`).join('')}</div>` : '<div class="empty-state compact">' + icon('check') + '<p>No tienes avances pendientes.</p></div>'}</section><section class="panel results-panel"><h2>Respuestas recibidas por el servidor</h2>${
    attempts.length
      ? `<div class="table-wrap"><table><thead><tr><th>Cuestionario</th><th>Calificación</th><th>Recibido</th><th>Estado</th></tr></thead><tbody>${attempts
          .slice()
          .reverse()
          .map(
            (a) =>
              `<tr><td>${esc(state.data.quizzes.find((q) => q.id === a.quizId)?.title || a.quizId)}<span class="small block">Versión ${a.quizVersion}</span></td><td><strong>${a.score} / ${a.total}</strong> · ${a.percentage}%</td><td>${date(a.submittedAt)}</td><td><span class="badge badge-green">Confirmado</span></td></tr>`
          )
          .join('')}</tbody></table></div>`
      : '<p class="subtitle">Los resultados aparecerán aquí después de sincronizar tus cuestionarios.</p>'
  }</section><p class="small">La sincronización automática se ejecuta al abrir la aplicación, al volver a ella y cada 30 segundos mientras está abierta. Requiere acceso al servidor; tener señal de internet por sí solo no garantiza que la PC esté disponible.</p>`;
}
function teacherView() {
  return `${header('Espacio docente', 'Comparte materiales y acompaña el avance de tus estudiantes.')}<div class="notice">${icon('teacher')} Las publicaciones se guardan en el servidor local. Los estudiantes reciben las nuevas versiones al sincronizar sus unidades descargadas.</div><div class="split-grid teacher-grid"><section class="panel"><h2>Publicar material</h2><form id="material-form"><input type="hidden" name="id" id="material-edit-id"><div class="form-field"><label for="material-course">Curso</label><select id="material-course" name="courseId">${state.data.courses.map((c) => `<option value="${esc(c.id)}">${esc(c.title)}</option>`).join('')}</select></div><div class="form-field"><label for="material-title">Título</label><input id="material-title" name="title" maxlength="180" required placeholder="Ej. El agua en nuestra comunidad"></div><div class="form-field"><label for="material-description">Descripción breve</label><input id="material-description" name="description" maxlength="500" required></div><div class="form-field"><label for="material-type">Tipo de material</label><select id="material-type" name="type"><option value="article">Lectura</option><option value="video">Video MP4 / WebM</option><option value="file">Documento PDF / archivo</option></select></div><div class="form-field" id="article-field"><label for="material-body">Contenido de la lectura</label><textarea id="material-body" name="body" rows="7" placeholder="Escribe el material educativo…"></textarea></div><div class="form-field" id="file-field" hidden><label for="material-file">Archivo local de hasta 20 MB</label><input id="material-file" name="file" type="file" accept=".pdf,.mp4,.webm,.txt,.png,.jpg,.jpeg"><p class="small">Adjunta el archivo real. Un enlace de YouTube requiere internet y no permite esta descarga sin conexión.</p></div><button class="button button-primary" type="submit">${icon('plus')} Publicar material</button><button class="button button-ghost" type="reset">Nuevo</button></form></section><section class="panel"><h2>Crear cuestionario</h2><p class="subtitle">Escribe de 1 a 10 preguntas. Selecciona la respuesta correcta para calificar en el servidor.</p><form id="quiz-editor-form"><div class="form-field"><label for="quiz-course">Curso</label><select id="quiz-course" name="courseId">${state.data.courses.map((c) => `<option value="${esc(c.id)}">${esc(c.title)}</option>`).join('')}</select></div><div class="form-field"><label for="quiz-title">Título</label><input id="quiz-title" name="title" maxlength="180" required></div><div id="question-editors">${questionEditor(0)}</div><button type="button" class="button button-secondary" data-action="add-question">${icon('plus')} Agregar pregunta</button><button class="button button-primary" type="submit">Publicar cuestionario</button></form></section></div><section class="panel results-panel"><h2>Materiales publicados</h2><div class="table-wrap"><table><thead><tr><th>Material</th><th>Curso</th><th>Versión</th><th>Acción</th></tr></thead><tbody>${state.data.materials.map((m) => `<tr><td>${esc(m.title)}</td><td>${esc(state.data.courses.find((c) => c.id === m.courseId)?.title)}</td><td>${m.version}</td><td><button class="button button-ghost" data-action="edit-material" data-id="${esc(m.id)}">Editar</button></td></tr>`).join('')}</tbody></table></div></section>${teacherAttempts()}`;
}
function teacherAttempts() {
  const attempts = state.data.attempts || [];
  return `<section class="panel results-panel"><h2>Avance recibido de estudiantes</h2><p class="subtitle">${attempts.length} intentos sincronizados en el servidor local.</p>${attempts.length ? `<div class="table-wrap"><table><thead><tr><th>Estudiante</th><th>Cuestionario</th><th>Resultado</th></tr></thead><tbody>${attempts.map((a) => `<tr><td>${esc(a.studentName || a.userName || a.userId || 'Estudiante')}</td><td>${esc(state.data.quizzes.find((q) => q.id === a.quizId)?.title || a.quizId)}</td><td>${a.score}/${a.total} · ${a.percentage}%</td></tr>`).join('')}</tbody></table></div>` : ''}</section>`;
}
function questionEditor(n) {
  return `<fieldset class="question-editor"><legend>Pregunta ${n + 1}</legend><div class="form-field"><label for="q${n}">Enunciado</label><input id="q${n}" name="prompt-${n}" required maxlength="500"></div>${[0, 1, 2].map((i) => `<div class="form-field"><label for="q${n}o${i}">Opción ${i + 1}</label><input id="q${n}o${i}" name="option-${n}-${i}" required maxlength="300"></div>`).join('')}<div class="form-field"><label for="correct-${n}">Respuesta correcta</label><select id="correct-${n}" name="correct-${n}"><option value="0">Opción 1</option><option value="1">Opción 2</option><option value="2">Opción 3</option></select></div></fieldset>`;
}
function guideView() {
  return `${header('Guía de uso', 'Instrucciones para descargar y enviar tus actividades.')}<div class="split-grid"><section class="panel"><h2>Cómo funciona</h2><ol class="steps-list"><li><strong>Conectar y descargar.</strong> El alumno ingresa y guarda una unidad completa.</li><li><strong>Aprender sin conexión.</strong> La interfaz, los contenidos descargados y las respuestas permanecen en el dispositivo.</li><li><strong>Recuperar conexión.</strong> La aplicación envía los eventos pendientes; el servidor verifica y confirma.</li><li><strong>Actualizar materiales.</strong> Las unidades descargadas reciben las nuevas versiones. Los intentos conservan la versión del cuestionario que respondieron.</li></ol></section><section class="panel"><h2>Tecnologías de esta versión</h2><p><strong>Interfaz:</strong> HTML, CSS y JavaScript con módulos.</p><p><strong>Servidor local:</strong> Node.js y API REST.</p><p><strong>Datos del servidor:</strong> SQLite y archivos locales.</p><p><strong>Sin conexión:</strong> IndexedDB, Service Worker y Cache API.</p><p><strong>Instalación:</strong> PWA en navegador compatible.</p></section><section class="panel"><h2>Guardar tus avances</h2><p>Los cursos descargados se almacenan en el navegador. Si borras los datos del sitio, podrías perder las respuestas que todavía no has enviado.</p><p>El servidor conserva las actividades confirmadas en la carpeta <strong>data</strong>. Es importante guardar copias de seguridad antes de reinstalar o cambiar de computadora.</p><p>Antes de utilizar cuentas reales, configura HTTPS confiable y valida los procedimientos de respaldo y acceso.</p></section><section class="panel"><h2>Instalar en PC o celular</h2><p><strong>PC:</strong> abre localhost:4173 desde Edge o Chrome y usa “Instalar aplicación” del navegador.</p><p><strong>Celular:</strong> conecta a la misma red de la PC y usa la dirección HTTPS con un certificado confiable. La guía local incluye la configuración.</p><p>El servidor puede estar en una red local sin salida a internet. Debe estar encendido y accesible para sincronizar.</p><button class="button button-primary" data-action="install">${icon('download')} Instalar o ver instrucciones</button></section></div><div class="notice">Versión académica con cuentas de demostración. La administración de usuarios y la asignación de cursos están disponibles. Antes de utilizar datos reales se requiere HTTPS, recuperación de acceso y respaldo operativo.</div>`;
}
function render() {
  if (!state.session || !state.data) return login();
  const user = state.session.user;
  if (state.view === 'admin' && user.role !== 'admin') state.view = 'home';
  if (state.view === 'teacher' && !['teacher', 'admin'].includes(user.role)) state.view = 'home';
  const routes = [
    ['home', 'home', 'Mi aprendizaje'],
    ['courses', 'book', 'Mis cursos'],
    ['downloads', 'download', 'Mis descargas'],
    ['sync', 'sync', 'Sincronización'],
    ...(['teacher', 'admin'].includes(user.role) ? [['teacher', 'teacher', 'Espacio docente']] : []),
    ...(user.role === 'admin' ? [['admin', 'shield', 'Administración']] : []),
    ['guide', 'help', 'Guía de uso']
  ];
  const active = state.view === 'course' ? 'courses' : state.view;
  root.innerHTML = `<div class="shell"><aside class="sidebar" id="sidebar"><a href="#home" class="brand" aria-label="AulaRaíz inicio">${icon('leaf')}<span>AulaRaíz<span class="brand-dot">.</span></span></a><div class="sidebar-label">MI AULA</div><nav aria-label="Menú principal">${routes.map(([view, i, title]) => `<button class="nav-link ${active === view ? 'active' : ''}" data-action="nav" data-view="${view}" ${active === view ? 'aria-current="page"' : ''}>${icon(i)}<span>${title}</span>${view === 'sync' && state.outbox.length ? `<span class="nav-count">${state.outbox.length}</span>` : ''}</button>`).join('')}</nav><div class="sidebar-footer"><div class="sidebar-tip">${icon('leaf')}<strong>Antes de desconectarte</strong><p>Descarga el material que vas a necesitar.</p></div><div class="sidebar-user"><span class="avatar">${esc(
    user.name
      .split(' ')
      .slice(0, 2)
      .map((x) => x[0])
      .join('')
  )}</span><div><strong>${esc(user.name.split(' ').slice(0, 2).join(' '))}</strong><span>${user.role === 'admin' ? 'Administrador' : user.role === 'teacher' ? 'Docente' : 'Estudiante'}</span></div><button class="icon-button" data-action="logout" title="Cerrar sesión" aria-label="Cerrar sesión">${icon('logout')}</button></div></div></aside><main class="main"><header class="topbar"><div class="breadcrumbs"><button class="icon-button mobile-menu" data-action="menu" aria-label="Abrir menú">${icon('menu')}</button><span>Mi aula</span><span class="breadcrumb-separator">/</span><strong>${routes.find((r) => r[0] === active)?.[2] || 'Mi aprendizaje'}</strong></div><div class="topbar-actions"><span class="connection-pill ${offline() ? 'is-offline' : ''}"><span class="status-dot"></span>${offline() ? 'Sin conexión al servidor' : 'Servidor disponible'}</span><button class="button button-ghost install-button" data-action="install">${icon('download')}<span>Instalar app</span></button></div></header><div class="page-content">${state.notice ? `<div class="notice warning">${esc(state.notice)} <button class="button button-ghost" data-action="logout">Volver a ingresar</button></div>` : ''}${!window.isSecureContext ? '<div class="notice warning">Esta dirección HTTP permite ver la aplicación, pero instalarla y usarla sin conexión requiere HTTPS confiable. En la PC usa localhost.</div>' : ''}${({ home, courses, course: courseDetail, downloads: downloadsView, sync: syncView, teacher: teacherView, admin: () => adminView({ state, header, icon, esc }), guide: guideView }[state.view] || home)()}<footer class="page-footer"><span>AulaRaíz · Materiales con y sin conexión</span><span>Versión de demostración</span></footer></div></main></div>`;
  if (state.view === 'downloads')
    navigator.storage?.estimate().then((info) => {
      const el = document.querySelector('#storage-info');
      if (el)
        el.textContent = `Este sitio usa ${size(info.usage || 0)} de aproximadamente ${size(info.quota || 0)} disponibles para el navegador.`;
    });
}
function navigate(view, id) {
  closeModal();
  state.view = view;
  state.courseId = id || null;
  state.search = '';
  history.replaceState(null, '', `#${view}${id ? '/' + encodeURIComponent(id) : ''}`);
  render();
  window.scrollTo({ top: 0 });
}
async function downloadCourse(courseId, silent = false) {
  if (state.downloading) throw new Error('Espera a que termine la descarga actual.');
  const userId = uid(),
    course = state.data.courses.find((c) => c.id === courseId);
  state.downloading = courseId;
  if (!silent) render();
  try {
    const materials = structuredClone(state.data.materials.filter((m) => m.courseId === courseId)),
      quizzes = structuredClone(state.data.quizzes.filter((q) => q.courseId === courseId));
    const assets = {};
    let bytes = 0;
    for (const m of materials)
      if (m.assetUrl) {
        const blob = await api(m.assetUrl.replace(/^\/api/, ''), { blob: true });
        assets[m.id] = blob;
        bytes += blob.size;
      }
    bytes += new Blob([JSON.stringify({ materials, quizzes })]).size;
    await db.put('downloads', `${userId}:${courseId}`, {
      userId,
      course,
      materials,
      quizzes,
      assets,
      bytes,
      downloadedAt: new Date().toISOString()
    });
    await loadLocal();
    if (!silent) toast('Unidad descargada. Ya puedes usarla sin conexión.');
  } catch (error) {
    if (!silent)
      toast(
        error.name === 'QuotaExceededError'
          ? 'No hay espacio suficiente. Libera espacio y vuelve a descargar.'
          : error.message
      );
    throw error;
  } finally {
    state.downloading = null;
    if (!silent) render();
  }
}
async function sync(manual = false) {
  if (state.syncing || !state.session) return;
  if (!navigator.onLine) {
    if (manual) toast('Sin conexión. Tus avances se conservaron en este equipo.');
    return;
  }
  const syncingUser = uid();
  state.syncing = true;
  if (manual) render();
  try {
    await loadLocal();
    const pending = state.outbox.slice();
    for (let offset = 0; offset < pending.length; offset += 100) {
      if (uid() !== syncingUser) return;
      const batch = pending.slice(offset, offset + 100);
      const result = await api('/sync', {
        method: 'POST',
        body: JSON.stringify({ events: batch.map(({ userId, error, ...event }) => event) })
      });
      for (const ack of result.accepted || []) await db.remove('outbox', `${syncingUser}:${ack.id}`);
      for (const rejection of result.rejected || []) {
        const event = batch.find((x) => x.id === rejection.id);
        if (event)
          await db.put('outbox', `${syncingUser}:${event.id}`, { ...event, error: rejection.reason });
      }
    }
    if (uid() !== syncingUser) return;
    await refresh();
    await loadLocal();
    const failed = [];
    for (const pack of state.downloads.slice()) {
      if (uid() !== syncingUser) return;
      if (hasUpdate(pack) && !state.downloading) {
        try {
          await downloadCourse(pack.course.id, true);
        } catch {
          failed.push(pack.course.id);
        }
      }
    }
    state.syncError = failed.length
      ? 'Hay unidades que no pudieron actualizarse. Vuelve a intentarlo cuando el servidor esté disponible.'
      : '';
    state.lastSync = new Date().toISOString();
    await db.put('kv', key('lastSync'), state.lastSync);
    if (manual)
      toast(
        state.syncError ||
          (state.outbox.length
            ? 'Algunos eventos necesitan revisión. Se mantienen guardados.'
            : 'Sincronización completada. Tus avances están confirmados.')
      );
  } catch (error) {
    state.syncError = error.message;
    if (manual) toast(error.message);
  } finally {
    state.syncing = false;
    if (
      !state.modal &&
      !document.querySelector('form :focus') &&
      !document.querySelector('#course-search:focus')
    )
      render();
  }
}
function closeModal() {
  document.querySelector('.modal-backdrop')?.remove();
  if (state.modal?.url) URL.revokeObjectURL(state.modal.url);
  state.modal = null;
  document.body.classList.remove('has-modal');
  const target = document.querySelector('[data-action="' + (closeModal.returnAction || 'course') + '"]');
  target?.focus({ preventScroll: true });
}
function modal(title, content, footer = '') {
  closeModal();
  const wrapper = document.createElement('div');
  wrapper.className = 'modal-backdrop';
  wrapper.innerHTML = `<section class="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><header class="dialog-header"><h2 id="dialog-title">${esc(title)}</h2><button class="icon-button" data-action="close-modal" aria-label="Cerrar ventana">${icon('close')}</button></header><div class="dialog-body">${content}</div>${footer ? `<footer class="dialog-footer">${footer}</footer>` : ''}</section>`;
  document.body.append(wrapper);
  document.body.classList.add('has-modal');
  wrapper.querySelector('button,input,textarea,select,a')?.focus();
}
async function openMaterial(materialId) {
  const m = courseData(state.courseId).materials.find((x) => x.id === materialId);
  if (!m) throw new Error('Descarga primero esta unidad para abrir el material.');
  let content = '',
    url;
  if (m.type === 'article')
    content = `<p class="subtitle">${esc(m.description)}</p><article class="reading-content">${(
      m.body || ''
    )
      .split(/\n\s*\n/)
      .map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`)
      .join('')}</article>`;
  else {
    const pack = downloaded(m.courseId);
    let blob =
      pack?.materials.find((x) => x.id === m.id)?.version === m.version ? pack.assets[m.id] : null;
    if (!blob) blob = await api(m.assetUrl.replace(/^\/api/, ''), { blob: true });
    url = URL.createObjectURL(blob);
    content = `<p>${esc(m.description)}</p>${m.type === 'video' ? `<video class="video-player" controls playsinline preload="metadata" src="${url}"></video>` : `<div class="file-preview">${icon('file')}<h3>${esc(m.filename || m.title)}</h3><a class="button button-primary" href="${url}" download="${esc(m.filename || 'material')}">Descargar archivo ${icon('download')}</a></div>`}`;
  }
  modal(
    m.title,
    content,
    `<span class="small">Versión ${m.version} · ${offline() ? 'Desde tu dispositivo' : 'Material educativo'}</span><button class="button button-primary" data-action="complete" data-id="${esc(m.id)}">${icon('check')} ${complete(m.id) ? 'Volver a marcar como completado' : 'Marcar como completado'}</button>`
  );
  state.modal = { type: 'material', material: m, url };
}
async function openQuiz(quizId) {
  const quiz = courseData(state.courseId).quizzes.find((q) => q.id === quizId);
  if (!quiz) throw new Error('Descarga primero la unidad para resolver el cuestionario.');
  const draft = (await db.get('drafts', key(`${quiz.id}:${quiz.version}`))) || {};
  modal(
    quiz.title,
    `<div class="notice">${icon('shield')} Tus respuestas se guardan en este dispositivo. La calificación se confirma después de sincronizar.</div><form id="attempt-form">${quiz.questions.map((q, n) => `<fieldset class="quiz-question"><legend><span class="question-number">${n + 1}</span> ${esc(q.prompt)}</legend>${q.options.map((option, i) => `<label class="option"><input type="radio" name="answer-${n}" value="${i}" ${draft[n] === i ? 'checked' : ''} required><span>${esc(option)}</span></label>`).join('')}</fieldset>`).join('')}<p class="small" id="draft-status">${Object.keys(draft).length ? 'Borrador recuperado de este dispositivo.' : 'El borrador se guarda al seleccionar una respuesta.'}</p><button class="button button-primary" type="submit">Guardar mis respuestas ${icon('check')}</button></form>`
  );
  state.modal = { type: 'quiz', quiz };
}
async function queueEvent(type, payload) {
  const event = {
    id: crypto.randomUUID(),
    type,
    payload,
    createdAt: new Date().toISOString(),
    userId: uid()
  };
  await db.put('outbox', key(event.id), event);
  await loadLocal();
  return event;
}
function formBusy(form, busy) {
  for (const button of form.querySelectorAll('button')) button.disabled = busy;
}

document.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action]');
  if (!button || button.disabled) return;
  const action = button.dataset.action,
    id = button.dataset.id;
  try {
    if (action === 'nav') navigate(button.dataset.view);
    if (action === 'course') navigate('course', id);
    if (action === 'menu') document.querySelector('#sidebar')?.classList.toggle('open');
    if (action === 'admin-reload') {
      await refresh();
      render();
      toast('Usuarios actualizados.');
    }
    if (action === 'admin-edit') {
      const user = state.adminUsers.find((item) => item.id === id);
      if (!user || user.role === 'admin')
        throw new Error('Este usuario no se puede editar desde el panel.');
      modal('Editar acceso', adminEditForm({ user, esc }));
      state.modal = { type: 'admin-edit' };
    }
    if (action === 'admin-own-password') {
      if (state.session?.user.role !== 'admin') throw new Error('Se requiere acceso de administrador.');
      modal('Cambiar mi contraseña', adminOwnPasswordForm());
      state.modal = { type: 'admin-own-password' };
    }
    if (action === 'admin-reset-password') {
      if (state.session?.user.role !== 'admin') throw new Error('Se requiere acceso de administrador.');
      const user = state.adminUsers.find((item) => item.id === id);
      if (!user || user.role === 'admin') throw new Error('Selecciona un alumno o docente.');
      modal('Restablecer contraseña', adminResetPasswordForm({ user, esc }));
      state.modal = { type: 'admin-reset-password' };
    }
    if (action === 'admin-courses') {
      const user = state.adminUsers.find((item) => item.id === id);
      if (!user || user.role !== 'student') throw new Error('Selecciona una cuenta de alumno.');
      modal('Cursos habilitados', adminCoursesForm({ user, courses: state.data.courses, esc }));
      state.modal = { type: 'admin-courses' };
    }
    if (action === 'demo-student' || action === 'demo-teacher') {
      const teacher = action === 'demo-teacher';
      document.querySelector('#email').value = teacher
        ? 'docente@aularaiz.local'
        : 'alumno@aularaiz.local';
      document.querySelector('#password').value = teacher ? 'Docente2026!' : 'Alumno2026!';
    }
    if (action === 'logout') {
      const token = state.session?.token;
      if (navigator.onLine && token)
        void fetch('/api/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => {});
      closeModal();
      clearSession();
      state.session = null;
      state.data = null;
      state.outbox = [];
      state.downloads = [];
      state.adminUsers = [];
      state.notice = '';
      state.syncError = '';
      login();
    }
    if (action === 'download') await downloadCourse(id);
    if (action === 'sync') await sync(true);
    if (action === 'material') await openMaterial(id);
    if (action === 'quiz') await openQuiz(id);
    if (action === 'close-modal') closeModal();
    if (action === 'complete') {
      const m = state.modal.material;
      await queueEvent('progress', { materialId: m.id, courseId: m.courseId, completed: true });
      closeModal();
      render();
      toast('Avance guardado en este dispositivo.');
      void sync();
    }
    if (action === 'remove-download') {
      const pack = downloaded(id);
      modal(
        'Eliminar descarga',
        `<p>Se eliminarán los contenidos descargados de <strong>${esc(pack.course.title)}</strong> de este dispositivo. Tus respuestas y avances pendientes se conservarán.</p>`,
        `<button class="button button-secondary" data-action="close-modal">Conservar</button><button class="button button-danger" data-action="confirm-remove-download" data-id="${esc(id)}">Eliminar descarga</button>`
      );
      state.modal = { type: 'remove' };
    }
    if (action === 'confirm-remove-download') {
      await db.remove('downloads', key(id));
      await loadLocal();
      closeModal();
      render();
      toast('Descarga eliminada. Tus avances se conservaron.');
    }
    if (action === 'persist') {
      const granted = await navigator.storage?.persist?.();
      toast(
        granted
          ? 'El navegador concedió almacenamiento persistente.'
          : 'El navegador no concedió almacenamiento persistente. Las descargas siguen disponibles.'
      );
    }
    if (action === 'install') {
      if (state.installPrompt) {
        await state.installPrompt.prompt();
        await state.installPrompt.userChoice;
        state.installPrompt = null;
      } else {
        modal(
          'Instalar AulaRaíz',
          `<p><strong>En PC:</strong> abre esta dirección en Microsoft Edge o Chrome. Usa el botón de instalación de la barra de direcciones o el menú Aplicaciones → Instalar este sitio como aplicación.</p><p><strong>En Android:</strong> abre la dirección HTTPS local con certificado confiable y selecciona “Instalar aplicación” o “Añadir a la pantalla principal”.</p><p><strong>En iPhone:</strong> abre la dirección HTTPS en Safari y elige Compartir → Añadir a la pantalla de inicio.</p><p>La carpeta del proyecto incluye la guía y el configurador para HTTPS en la red local. Tras el primer ingreso, descarga una unidad y prueba sin conexión.</p>`
        );
        state.modal = { type: 'install' };
      }
    }
    if (action === 'add-question') {
      const container = document.querySelector('#question-editors');
      const n = container.children.length;
      if (n >= 10) throw new Error('El cuestionario admite hasta 10 preguntas.');
      container.insertAdjacentHTML('beforeend', questionEditor(n));
    }
    if (action === 'edit-material') {
      const m = state.data.materials.find((x) => x.id === id);
      const form = document.querySelector('#material-form');
      for (const field of ['id', 'courseId', 'title', 'description', 'type', 'body'])
        if (form.elements[field]) form.elements[field].value = m[field] || '';
      document.querySelector('#article-field').hidden = m.type !== 'article';
      document.querySelector('#file-field').hidden = m.type === 'article';
      form.scrollIntoView({ behavior: 'smooth' });
      form.elements.title.focus();
      toast('Edita el material y publica para crear una nueva versión.');
    }
  } catch (error) {
    toast(error.message);
  }
});
document.addEventListener('submit', async (event) => {
  const form = event.target,
    formId = form.getAttribute('id');
  if (
    ![
      'login-form',
      'material-form',
      'quiz-editor-form',
      'attempt-form',
      'admin-create-form',
      'admin-edit-form',
      'admin-courses-form',
      'admin-reset-password-form',
      'admin-own-password-form'
    ].includes(formId)
  )
    return;
  event.preventDefault();
  formBusy(form, true);
  try {
    const values = new FormData(form);
    if (formId === 'login-form') {
      const session = await api('/login', {
        method: 'POST',
        body: JSON.stringify({ email: values.get('email'), password: values.get('password') })
      });
      state.session = session;
      await refresh();
      saveSession(session);
      await loadLocal();
      state.notice = '';
      state.syncError = '';
      state.view =
        session.user.role === 'admin' ? 'admin' : session.user.role === 'teacher' ? 'teacher' : 'home';
      location.hash = state.view;
      render();
      void sync();
    }
    if (formId === 'admin-create-form') {
      const payload = {
        name: values.get('name'),
        email: values.get('email'),
        role: values.get('role'),
        password: values.get('password')
      };
      await api('/admin/users', { method: 'POST', body: JSON.stringify(payload) });
      await loadAdministration();
      render();
      toast('Cuenta creada. Ya puedes asignarle cursos si es alumno.');
    }
    if (formId === 'admin-edit-form') {
      const id = values.get('id');
      const payload = {
        name: values.get('name'),
        email: values.get('email'),
        role: values.get('role'),
        isActive: values.has('isActive')
      };
      await api('/admin/users/' + encodeURIComponent(id), {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
      closeModal();
      await loadAdministration();
      render();
      toast('Datos y acceso actualizados en SQLite.');
    }
    if (formId === 'admin-reset-password-form') {
      const newPassword = values.get('newPassword');
      if (newPassword !== values.get('confirmPassword'))
        throw new Error('Las contraseñas no coinciden.');
      await api('/admin/users/' + encodeURIComponent(values.get('id')), {
        method: 'PATCH',
        body: JSON.stringify({ password: newPassword })
      });
      closeModal();
      toast('Contraseña restablecida en SQLite. El usuario deberá volver a iniciar sesión.');
    }
    if (formId === 'admin-own-password-form') {
      const currentPassword = values.get('currentPassword');
      const newPassword = values.get('newPassword');
      if (newPassword !== values.get('confirmPassword'))
        throw new Error('Las contraseñas no coinciden.');
      await api('/admin/password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword })
      });
      closeModal();
      clearSession();
      state.session = null;
      state.data = null;
      state.downloads = [];
      state.outbox = [];
      state.adminUsers = [];
      state.notice = '';
      state.syncError = '';
      state.view = 'home';
      history.replaceState(null, '', '#home');
      login();
      toast('Contraseña actualizada. Inicia sesión nuevamente con tu nueva clave.');
    }
    if (formId === 'admin-courses-form') {
      const id = values.get('id');
      await api('/admin/users/' + encodeURIComponent(id) + '/courses', {
        method: 'PUT',
        body: JSON.stringify({ courseIds: values.getAll('courseIds') })
      });
      closeModal();
      await loadAdministration();
      render();
      toast('Cursos habilitados actualizados.');
    }
    if (formId === 'material-form') {
      const payload = Object.fromEntries(
        ['id', 'courseId', 'title', 'description', 'type', 'body'].map((k) => [k, values.get(k)])
      );
      if (!payload.id) delete payload.id;
      if (payload.type === 'article' && !payload.body?.trim())
        throw new Error('Escribe el contenido de la lectura.');
      const file = values.get('file');
      if (file?.size) {
        if (file.size > 20 * 1024 * 1024) throw new Error('El archivo supera los 20 MB.');
        const encoded = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result.split(',')[1]);
          reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
          reader.readAsDataURL(file);
        });
        payload.file = { name: file.name, type: file.type, data: encoded };
      } else if (payload.type !== 'article' && !payload.id)
        throw new Error('Selecciona el archivo que vas a publicar.');
      await api('/materials', { method: 'POST', body: JSON.stringify(payload) });
      await refresh();
      render();
      toast('Material publicado. La nueva versión ya está en el servidor.');
    }
    if (formId === 'quiz-editor-form') {
      const questions = Array.from(form.querySelectorAll('.question-editor')).map((_, n) => ({
        prompt: values.get(`prompt-${n}`),
        options: [0, 1, 2].map((i) => values.get(`option-${n}-${i}`)),
        correctIndex: Number(values.get(`correct-${n}`))
      }));
      await api('/quizzes', {
        method: 'POST',
        body: JSON.stringify({ courseId: values.get('courseId'), title: values.get('title'), questions })
      });
      await refresh();
      render();
      toast('Cuestionario publicado.');
    }
    if (formId === 'attempt-form') {
      const quiz = state.modal.quiz,
        answers = quiz.questions.map((_, n) => Number(values.get(`answer-${n}`)));
      if (answers.some((answer, n) => !values.has(`answer-${n}`) || !Number.isInteger(answer)))
        throw new Error('Responde todas las preguntas.');
      await queueEvent('attempt', { quizId: quiz.id, quizVersion: quiz.version, answers });
      await db.remove('drafts', key(`${quiz.id}:${quiz.version}`));
      closeModal();
      render();
      toast('Respuestas guardadas. Se confirmarán al sincronizar con el servidor.');
      void sync();
    }
  } catch (error) {
    if (formId === 'login-form') {
      const el = document.querySelector('#login-error');
      if (el) el.textContent = error.message;
    } else
      toast(
        error.name === 'QuotaExceededError'
          ? 'El dispositivo no tiene espacio para guardar. Libera espacio antes de continuar.'
          : error.message
      );
  } finally {
    formBusy(form, false);
  }
});
document.addEventListener('change', async (event) => {
  if (event.target.id === 'material-type') {
    const article = event.target.value === 'article';
    document.querySelector('#article-field').hidden = !article;
    document.querySelector('#file-field').hidden = article;
  }
  if (event.target.closest('#attempt-form') && state.modal?.type === 'quiz') {
    try {
      const quiz = state.modal.quiz,
        values = new FormData(document.querySelector('#attempt-form')),
        draft = {};
      quiz.questions.forEach((_, n) => {
        if (values.has(`answer-${n}`)) draft[n] = Number(values.get(`answer-${n}`));
      });
      await db.put('drafts', key(`${quiz.id}:${quiz.version}`), draft);
      const el = document.querySelector('#draft-status');
      if (el) el.textContent = 'Borrador guardado en este dispositivo.';
    } catch {
      toast('No se pudo guardar el borrador. Revisa el espacio del dispositivo.');
    }
  }
});
document.addEventListener('input', (event) => {
  if (event.target.id === 'admin-search') {
    const search = event.target.value.toLocaleLowerCase('es').trim();
    document.querySelectorAll('[data-admin-user-row]').forEach((row) => {
      row.hidden = !row.textContent.toLocaleLowerCase('es').includes(search);
    });
  }
  if (event.target.id === 'course-search') {
    state.search = event.target.value;
    const start = event.target.selectionStart;
    render();
    const field = document.querySelector('#course-search');
    field.focus();
    try {
      field.setSelectionRange(start, start);
    } catch {}
  }
});
document.addEventListener('reset', (event) => {
  if (event.target.getAttribute('id') === 'material-form')
    setTimeout(() => {
      document.querySelector('#material-edit-id').value = '';
      document.querySelector('#article-field').hidden = false;
      document.querySelector('#file-field').hidden = true;
    }, 0);
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && state.modal) closeModal();
  if (event.key === 'Tab' && state.modal) {
    const items = [
      ...document.querySelectorAll(
        '.dialog button,.dialog input,.dialog a,.dialog select,.dialog textarea,.dialog video'
      )
    ].filter((el) => !el.disabled && el.offsetParent !== null);
    const first = items[0],
      last = items.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
});
window.addEventListener('offline', () => {
  state.connected = false;
  if (!state.modal) render();
  toast('Sin conexión. Puedes continuar con tus unidades descargadas.');
});
window.addEventListener('online', () => void sync());
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  state.installPrompt = event;
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) void sync();
});
setInterval(() => {
  if (!document.hidden) void sync();
}, 30000);
async function restoreSession() {
  const saved = readSession();
  if (!saved) return;

  if (!(await canResumeOfflineSession())) {
    clearSession();
    return;
  }

  try {
    state.session = saved;
    state.data = await db.get('kv', key('snapshot'));
    await loadLocal();

    try {
      await refresh();
    } catch (error) {
      if (error.status === 401) throw error;
      state.connected = false;
      if (!state.data) throw error;
    }

    const [route, course] = location.hash.slice(1).split('/');
    state.view = [
      'home',
      'courses',
      'downloads',
      'sync',
      'guide',
      'teacher',
      'admin',
      'course'
    ].includes(route)
      ? route
      : 'home';
    state.courseId = course ? decodeURIComponent(course) : null;
    if (state.view === 'teacher' && !['teacher', 'admin'].includes(saved.user.role)) state.view = 'home';
    if (state.view === 'admin' && saved.user.role !== 'admin') state.view = 'home';
  } catch (error) {
    clearSession();
    state.session = null;
    state.data = null;
    state.downloads = [];
    state.outbox = [];
    if (error.status === 401) toast('La sesión ha terminado. Vuelve a ingresar.');
  }
}

async function start() {
  try {
    if ('serviceWorker' in navigator) {
      await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      state.swReady = true;
    }
  } catch (error) {
    console.warn('No se pudo preparar el modo sin conexión', error);
  }

  await restoreSession();
  render();
  if (state.session) void sync();
}

void start();
