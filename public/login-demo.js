// Las cuentas de ejemplo se seleccionan únicamente a petición del usuario.
export const DEMO_USERS = Object.freeze({
  student: Object.freeze({
    email: 'alumno@aularaiz.local',
    password: 'Alumno2026!'
  }),
  teacher: Object.freeze({
    email: 'docente@aularaiz.local',
    password: 'Docente2026!'
  })
});

export function selectDemoUser(form, role) {
  if (!Object.hasOwn(DEMO_USERS, role) || !form?.elements) return false;
  const email = form.elements.namedItem('email');
  const password = form.elements.namedItem('password');
  if (!email || !password) return false;

  // Sustituye los dos datos para evitar mezclar cuentas al cambiar de perfil.
  email.value = DEMO_USERS[role].email;
  password.value = DEMO_USERS[role].password;
  return true;
}
