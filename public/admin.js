export function adminView({ state, header, icon, esc }) {
  const users = state.adminUsers || [];
  const students = users.filter((user) => user.role === 'student');
  const teachers = users.filter((user) => user.role === 'teacher');
  const active = users.filter((user) => user.isActive);
  const admins = users.filter((user) => user.role === 'admin');
  const title = {
    student: 'Alumno',
    teacher: 'Docente',
    admin: 'Administrador'
  };
  const count = (number, label, symbol) =>
    `<div class="stat-card"><span class="stat-icon">${icon(symbol)}</span><div><span class="stat-value">${number}</span><span class="stat-label">${label}</span></div></div>`;
  return `${header('Administración de usuarios', 'Gestiona las cuentas, permisos y cursos desde la misma base SQLite.')}
    <section class="panel admin-security">
      <div><h2>Seguridad del administrador</h2>
      <p class="subtitle">Actualiza tu contraseña sin modificar los datos académicos.</p></div>
      <button type="button" class="button button-secondary" data-action="admin-own-password">Cambiar mi contraseña</button>
    </section>
    <div class="stats admin-stats">
      ${count(students.length, 'Alumnos', 'book')}
      ${count(teachers.length, 'Docentes', 'teacher')}
      ${count(active.length, 'Cuentas habilitadas', 'check')}
      ${count(users.length - active.length, 'Cuentas deshabilitadas', 'shield')}
    </div>
    <div class="split-grid admin-layout">
      <section class="panel">
        <h2>Registrar usuario</h2>
        <p class="subtitle">Crea credenciales para un alumno o docente. Los nuevos alumnos no tendrán cursos hasta que los asignes.</p>
        <form id="admin-create-form" autocomplete="off">
          <div class="form-field"><label for="admin-new-name">Nombre completo</label><input id="admin-new-name" name="name" required minlength="2" maxlength="160" placeholder="Nombres y apellidos"></div>
          <div class="form-field"><label for="admin-new-email">Correo de acceso</label><input id="admin-new-email" name="email" type="email" required maxlength="200" autocomplete="off" placeholder="usuario@correo.com"></div>
          <div class="form-field"><label for="admin-new-role">Perfil</label><select id="admin-new-role" name="role"><option value="student">Alumno</option><option value="teacher">Docente</option></select></div>
          <div class="form-field"><label for="admin-new-password">Contraseña inicial</label><input id="admin-new-password" name="password" type="password" required minlength="10" autocomplete="new-password" placeholder="Mínimo 10 caracteres"></div>
          <button type="submit" class="button button-primary">${icon('plus')} Registrar usuario</button>
        </form>
      </section>
      <section class="panel admin-list">
        <div class="admin-list-title"><div><h2>Usuarios registrados</h2><p class="subtitle">${users.length} cuentas, incluidas ${admins.length} de administración.</p></div><button type="button" class="button button-secondary" data-action="admin-reload">${icon('sync')} Actualizar</button></div>
        <div class="form-field"><label for="admin-search">Buscar por nombre, correo o perfil</label><input id="admin-search" type="search" placeholder="Buscar usuario…" autocomplete="off"></div>
        <div class="table-wrap">
          <table class="admin-users">
            <thead><tr><th>Usuario</th><th>Perfil</th><th>Estado</th><th>Cursos</th><th>Acciones</th></tr></thead>
            <tbody>
              ${users
                .map(
                  (user) => `<tr data-admin-user-row>
                <td><strong>${esc(user.name)}</strong><span class="small block">${esc(user.email)}</span></td>
                <td>${title[user.role] || esc(user.role)}</td>
                <td><span class="badge ${user.isActive ? 'badge-green' : 'badge-amber'}">${user.isActive ? 'Habilitado' : 'Deshabilitado'}</span></td>
                <td>${user.role === 'student' ? user.courseIds.length : '—'}</td>
                <td><div class="admin-row-actions">
                  ${
                    user.role === 'admin'
                      ? '<span class="small">Protegido</span>'
                      : `<button type="button" class="button button-ghost" data-action="admin-edit" data-id="${esc(user.id)}">Editar</button>
                       <button type="button" class="button button-secondary" data-action="admin-reset-password" data-id="${esc(user.id)}">Restablecer contraseña</button>
                       ${user.role === 'student' ? `<button type="button" class="button button-secondary" data-action="admin-courses" data-id="${esc(user.id)}">Cursos</button>` : ''}`
                  }
                </div></td>
              </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>
        <p class="small">Deshabilitar una cuenta revoca sus sesiones. El historial académico se conserva.</p>
      </section>
    </div>`;
}

export function adminEditForm({ user, esc }) {
  return `<form id="admin-edit-form" autocomplete="off">
    <input type="hidden" name="id" value="${esc(user.id)}">
    <div class="form-field"><label for="admin-edit-name">Nombre completo</label><input id="admin-edit-name" name="name" value="${esc(user.name)}" maxlength="160" required></div>
    <div class="form-field"><label for="admin-edit-email">Correo electrónico</label><input id="admin-edit-email" name="email" type="email" value="${esc(user.email)}" maxlength="200" required></div>
    <div class="form-field"><label for="admin-edit-role">Tipo de usuario</label>
      <select id="admin-edit-role" name="role">
        <option value="student" ${user.role === 'student' ? 'selected' : ''}>Alumno</option>
        <option value="teacher" ${user.role === 'teacher' ? 'selected' : ''}>Docente</option>
      </select>
    </div>
    <label class="admin-checkbox"><input type="checkbox" name="isActive" ${user.isActive ? 'checked' : ''}> Permitir el acceso a AulaRaíz</label>
    <p class="small">Al cambiar el rol o el estado se cerrarán las sesiones anteriores. Los resultados existentes no se eliminan.</p>
    <button type="submit" class="button button-primary">Guardar cambios</button>
  </form>`;
}

export function adminCoursesForm({ user, courses, esc }) {
  const selected = new Set(user.courseIds);
  return `<form id="admin-courses-form">
    <input type="hidden" name="id" value="${esc(user.id)}">
    <p>Selecciona los cursos que puede consultar <strong>${esc(user.name)}</strong>. Puedes dejar todos desmarcados para restringir temporalmente el acceso.</p>
    <div class="admin-course-list">
      ${courses.map((course) => `<label class="admin-checkbox"><input type="checkbox" name="courseIds" value="${esc(course.id)}" ${selected.has(course.id) ? 'checked' : ''}><span><strong>${esc(course.title)}</strong><span class="small block">${esc(course.subject || course.description)}</span></span></label>`).join('')}
    </div>
    <p class="small">El cambio se aplicará en el servidor inmediatamente; el alumno verá su nueva selección cuando vuelva a conectarse.</p>
    <button type="submit" class="button button-primary">Guardar cursos habilitados</button>
  </form>`;
}

export function adminResetPasswordForm({ user, esc }) {
  return `<form id="admin-reset-password-form" autocomplete="off">
    <input type="hidden" name="id" value="${esc(user.id)}">
    <p>Estás restableciendo el acceso de <strong>${esc(user.name)}</strong>. Su contraseña anterior dejará de funcionar.</p>
    <div class="form-field"><label for="reset-new-password">Nueva contraseña</label><input id="reset-new-password" name="newPassword" type="password" autocomplete="new-password" minlength="10" maxlength="200" required></div>
    <div class="form-field"><label for="reset-confirm-password">Confirmar nueva contraseña</label><input id="reset-confirm-password" name="confirmPassword" type="password" autocomplete="new-password" minlength="10" maxlength="200" required></div>
    <p class="small">El servidor guardará una contraseña protegida en SQLite y cerrará las sesiones actuales de este usuario. No se borrarán sus avances.</p>
    <button class="button button-primary" type="submit">Confirmar restablecimiento</button>
  </form>`;
}

export function adminOwnPasswordForm() {
  return `<form id="admin-own-password-form" autocomplete="off">
    <div class="form-field"><label for="own-current-password">Contraseña actual</label><input id="own-current-password" name="currentPassword" type="password" autocomplete="current-password" required></div>
    <div class="form-field"><label for="own-new-password">Nueva contraseña</label><input id="own-new-password" name="newPassword" type="password" autocomplete="new-password" minlength="10" maxlength="200" required></div>
    <div class="form-field"><label for="own-confirm-password">Confirmar nueva contraseña</label><input id="own-confirm-password" name="confirmPassword" type="password" autocomplete="new-password" minlength="10" maxlength="200" required></div>
    <p class="small">Después del cambio tendrás que volver a iniciar sesión con tu nueva contraseña.</p>
    <button class="button button-primary" type="submit">Guardar mi nueva contraseña</button>
  </form>`;
}
