import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_QUIZZES,
  activeQuizFilter,
  filterAttemptsByQuiz,
  formatAttemptDate,
  quizFilterOptions,
  sortAttemptsNewestFirst
} from '../public/attempts-view.js';

const quizzes = [
  { id: 'q-agua', title: 'El agua' },
  { id: 'q-suelo', title: 'El suelo' },
  { id: 'q-sin-intentos', title: 'Las plantas' }
];
const attempts = [
  { id: 'a1', quizId: 'q-agua', submittedAt: '2026-11-10T15:00:00.000Z' },
  { id: 'a2', quizId: 'q-suelo', submittedAt: '2026-11-12T09:30:00.000Z' },
  { id: 'a3', quizId: 'q-agua', submittedAt: '2026-11-11T20:45:00.000Z' }
];
const ids = (list) => list.map((a) => a.id);

test('los intentos se ordenan del más reciente al más antiguo sin alterar la lista original', () => {
  const original = attempts.slice();
  assert.deepEqual(ids(sortAttemptsNewestFirst(attempts)), ['a2', 'a3', 'a1']);
  assert.deepEqual(attempts, original);
});

test('los intentos sin fecha válida quedan al final', () => {
  const list = [
    { id: 'sin-fecha', quizId: 'q-agua' },
    { id: 'invalida', quizId: 'q-agua', submittedAt: 'no es una fecha' },
    ...attempts
  ];
  assert.deepEqual(ids(sortAttemptsNewestFirst(list)), ['a2', 'a3', 'a1', 'sin-fecha', 'invalida']);
  assert.deepEqual(sortAttemptsNewestFirst(undefined), []);
});

test('el filtro muestra solo los intentos del cuestionario elegido', () => {
  assert.deepEqual(ids(filterAttemptsByQuiz(attempts, 'q-agua')), ['a1', 'a3']);
  assert.deepEqual(ids(filterAttemptsByQuiz(attempts, 'q-suelo')), ['a2']);
  assert.deepEqual(filterAttemptsByQuiz(attempts, 'q-sin-intentos'), []);
});

test('el filtro «todos» conserva todos los intentos', () => {
  assert.deepEqual(ids(filterAttemptsByQuiz(attempts, ALL_QUIZZES)), ['a1', 'a2', 'a3']);
  assert.deepEqual(ids(filterAttemptsByQuiz(attempts, '')), ['a1', 'a2', 'a3']);
  assert.deepEqual(ids(filterAttemptsByQuiz(attempts, undefined)), ['a1', 'a2', 'a3']);
});

test('las opciones incluyen solo cuestionarios con intentos y sin duplicados', () => {
  assert.deepEqual(quizFilterOptions(attempts, quizzes), [
    { id: 'q-agua', title: 'El agua' },
    { id: 'q-suelo', title: 'El suelo' }
  ]);
  assert.deepEqual(quizFilterOptions([], quizzes), []);
});

test('un cuestionario que ya no está en el catálogo se identifica por su id', () => {
  const list = [
    ...attempts,
    { id: 'a4', quizId: 'q-retirado', submittedAt: '2026-11-09T10:00:00.000Z' }
  ];
  assert.deepEqual(quizFilterOptions(list, quizzes), [
    { id: 'q-agua', title: 'El agua' },
    { id: 'q-suelo', title: 'El suelo' },
    { id: 'q-retirado', title: 'q-retirado' }
  ]);
});

test('el filtro activo vuelve a «todos» si el cuestionario elegido ya no tiene intentos', () => {
  const options = quizFilterOptions(attempts, quizzes);
  assert.equal(activeQuizFilter(options, 'q-suelo'), 'q-suelo');
  assert.equal(activeQuizFilter(options, 'q-sin-intentos'), ALL_QUIZZES);
  assert.equal(activeQuizFilter(options, undefined), ALL_QUIZZES);
});

test('la fecha del intento se muestra con día y hora en formato local', () => {
  const text = formatAttemptDate('2026-11-12T23:15:00.000Z', { timeZone: 'America/Lima' });
  assert.match(text, /12\/11\/(20)?26/);
  assert.match(text, /6:15/);
});

test('una fecha ausente o inválida muestra un texto alternativo', () => {
  assert.equal(formatAttemptDate(undefined), 'Sin fecha');
  assert.equal(formatAttemptDate(null), 'Sin fecha');
  assert.equal(formatAttemptDate(''), 'Sin fecha');
  assert.equal(formatAttemptDate('no es una fecha'), 'Sin fecha');
});
