// Orden, filtro y fecha de los intentos que revisa el docente. Sin acceso al DOM ni a la red.
export const ALL_QUIZZES = 'all';
const NO_DATE = 'Sin fecha';

function time(value) {
  const ms = value ? new Date(value).getTime() : NaN;
  return Number.isNaN(ms) ? null : ms;
}

export function sortAttemptsNewestFirst(attempts) {
  return (attempts || []).slice().sort((a, b) => {
    const first = time(a.submittedAt),
      second = time(b.submittedAt);
    // Los intentos sin fecha válida se muestran al final.
    if (first === null || second === null) return (first === null) - (second === null);
    return second - first;
  });
}

export function filterAttemptsByQuiz(attempts, quizId) {
  const list = attempts || [];
  if (!quizId || quizId === ALL_QUIZZES) return list.slice();
  return list.filter((a) => a.quizId === quizId);
}

export function quizFilterOptions(attempts, quizzes) {
  const used = new Set((attempts || []).map((a) => a.quizId));
  const options = (quizzes || [])
    .filter((q) => used.delete(q.id))
    .map((q) => ({ id: q.id, title: q.title || q.id }));
  // Un intento puede corresponder a un cuestionario que ya no figura en el catálogo.
  return [...options, ...[...used].map((id) => ({ id, title: id }))];
}

export function activeQuizFilter(options, selected) {
  return (options || []).some((o) => o.id === selected) ? selected : ALL_QUIZZES;
}

export function formatAttemptDate(value, { timeZone } = {}) {
  const ms = time(value);
  if (ms === null) return NO_DATE;
  return new Intl.DateTimeFormat('es-PE', { dateStyle: 'short', timeStyle: 'short', timeZone }).format(
    ms
  );
}
