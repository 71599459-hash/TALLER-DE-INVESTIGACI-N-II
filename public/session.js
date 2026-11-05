// La sesión pertenece a esta pestaña. Las descargas se guardan aparte.
const STORAGE_KEY = 'aularaiz-session';

function validSession(value) {
  return Boolean(value &&
    typeof value.token === 'string' &&
    /^[a-f0-9]{64}$/.test(value.token) &&
    typeof value.serverId === 'string' &&
    value.serverId.length > 0 &&
    value.user &&
    typeof value.user.id === 'string' &&
    ['student', 'teacher'].includes(value.user.role));
}

export function clearSession() {
  sessionStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(STORAGE_KEY);
}

export function readSession() {
  // Elimina las sesiones de larga duración de versiones anteriores.
  localStorage.removeItem(STORAGE_KEY);
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    const session = stored ? JSON.parse(stored) : null;
    if (validSession(session)) return session;
  } catch {
    // Una sesión inválida requiere un nuevo inicio de sesión.
  }
  sessionStorage.removeItem(STORAGE_KEY);
  return null;
}

export function saveSession(session) {
  if (!validSession(session)) throw new Error('La respuesta de inicio de sesión no es válida.');
  localStorage.removeItem(STORAGE_KEY);
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export async function sessionBelongsToServer(session) {
  // Una recarga sin conexión conserva el trabajo en esta pestaña.
  if (!navigator.onLine) return true;
  try {
    const response = await fetch('/api/health', {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) return true;
    const { serverId } = await response.json();
    return serverId === session.serverId;
  } catch {
    return true;
  }
}
