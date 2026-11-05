import { randomBytes, scryptSync } from 'node:crypto';

export function passwordHash(password, salt = randomBytes(16).toString('hex')) {
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}

export const courses = [
  { id: 'ciencias', title: 'Ciencia y ambiente', description: 'Comprende tu entorno y aprende a cuidarlo con actividades cercanas a tu comunidad.', subject: 'Ciencias', level: 'Secundaria · 1.º', color: 'green', icon: 'leaf' },
  { id: 'matematica', title: 'Matemática en la vida diaria', description: 'Resuelve situaciones cotidianas con proporciones, porcentajes y pensamiento lógico.', subject: 'Matemática', level: 'Secundaria · 1.º', color: 'orange', icon: 'calculator' },
  { id: 'comunicacion', title: 'Lectura y comunicación', description: 'Lee con atención, identifica ideas principales y expresa tus propias conclusiones.', subject: 'Comunicación', level: 'Secundaria · 1.º', color: 'purple', icon: 'book' }
];

const materialSeeds = [
  {
    id: 'agua-comunidad', courseId: 'ciencias', title: 'El agua que compartimos', description: 'Reconoce el ciclo del agua y pequeñas acciones para proteger este recurso.', type: 'article',
    body: 'El agua circula constantemente entre la superficie de la Tierra y la atmósfera. El calor del Sol provoca la evaporación. Cuando el vapor se enfría, se condensa y forma nubes. Después, el agua regresa como precipitación: lluvia, nieve o granizo.\n\nUna parte del agua se infiltra en el suelo y otra fluye hacia ríos y lagunas. La vegetación ayuda a conservar los suelos y favorece la infiltración. Por eso, cuidar los árboles y evitar arrojar residuos al río protege las fuentes de agua de la comunidad.\n\nActividad: observa cómo se utiliza el agua en tu casa. Escribe tres acciones para reducir el desperdicio. Conversa con tu familia sobre la forma en que cambia la disponibilidad de agua durante el año.\n\nRecuerda: el agua disponible para beber necesita un tratamiento adecuado. Esta lectura describe el ciclo natural; no reemplaza las indicaciones sanitarias de tu localidad.'
  },
  {
    id: 'ecosistema-local', courseId: 'ciencias', title: 'Un ecosistema cerca de ti', description: 'Explora las relaciones entre seres vivos, suelo, agua y luz.', type: 'article',
    body: 'Un ecosistema reúne seres vivos y elementos no vivos que se relacionan en un lugar. Las plantas, los animales y los microorganismos forman parte de sus componentes vivos. El agua, la luz, el aire y la temperatura son componentes no vivos.\n\nLas plantas producen su alimento mediante la fotosíntesis. Algunos animales comen plantas y otros se alimentan de animales. Los descomponedores transforman restos orgánicos y devuelven nutrientes al suelo.\n\nActividad: elige un jardín, una chacra o la orilla de un río. Anota cinco componentes vivos y tres no vivos. Dibuja dos relaciones entre ellos. No extraigas plantas ni molestes a los animales.\n\nPara reflexionar: ¿qué podría ocurrir si desapareciera una fuente de agua del ecosistema que observaste?'
  },
  {
    id: 'porcentajes-mercado', courseId: 'matematica', title: 'Porcentajes en el mercado', description: 'Calcula descuentos y compara precios con ejemplos sencillos.', type: 'article',
    body: 'Un porcentaje representa una cantidad de cada cien partes. Por ejemplo, 25 % equivale a 25 de cada 100 y también a la cuarta parte de una cantidad.\n\nPara calcular el 10 % de S/ 80, multiplicamos 80 por 10 y dividimos entre 100. El resultado es S/ 8. Si ese es el descuento de una compra, el precio final será 80 − 8 = S/ 72.\n\nEl 50 % es la mitad. El 20 % puede encontrarse calculando primero el 10 % y multiplicando por dos. Siempre verifica si se pregunta por el monto del descuento o por el precio que se pagará.\n\nPractica: una mochila cuesta S/ 60 y tiene 25 % de descuento. ¿Cuánto se descuenta? ¿Cuál es el precio final? Explica tu procedimiento antes de responder el cuestionario.'
  },
  {
    id: 'proporciones-recetas', courseId: 'matematica', title: 'Proporciones para compartir', description: 'Adapta una receta y reconoce relaciones proporcionales.', type: 'article',
    body: 'Dos cantidades son directamente proporcionales cuando, al multiplicar una por un número, la otra se multiplica por ese mismo número.\n\nSi una receta para cuatro personas utiliza dos tazas de arroz, para ocho personas se necesita el doble: cuatro tazas. Para dos personas, se necesita la mitad: una taza.\n\nPodemos organizar los datos en una tabla: 2 personas → 1 taza; 4 personas → 2 tazas; 8 personas → 4 tazas. La relación entre personas y tazas se mantiene.\n\nActividad: inventa una receta sencilla para tres personas. Indica las cantidades necesarias para seis y para nueve personas. Explica por qué las cantidades son proporcionales.'
  },
  {
    id: 'idea-principal', courseId: 'comunicacion', title: 'Encuentra la idea principal', description: 'Distingue el mensaje central de los detalles que lo explican.', type: 'article',
    body: 'La idea principal es el mensaje central de un texto. Los detalles aportan ejemplos, explicaciones o información que ayuda a comprenderla.\n\nLee este párrafo: “La biblioteca comunal abre sus puertas cada tarde. Niñas y niños encuentran cuentos, consultan libros y realizan tareas en un espacio tranquilo. Las familias también se reúnen para intercambiar lecturas”.\n\nEl tema es la biblioteca comunal. Una idea principal posible es: la biblioteca ofrece a la comunidad un espacio para aprender y compartir lecturas. Los horarios y las actividades mencionadas son detalles que apoyan esa idea.\n\nActividad: escribe un título para el párrafo. Luego explica su idea principal con tus palabras, sin copiar toda la lectura. Compara tu respuesta con la de un compañero.'
  },
  {
    id: 'opinion-evidencia', courseId: 'comunicacion', title: 'Una opinión con razones', description: 'Construye una opinión clara y apóyala con información de una lectura.', type: 'article',
    body: 'Una opinión expresa lo que pensamos sobre un tema. Para que otras personas comprendan nuestra posición, necesitamos razones claras y evidencia relacionada con el texto o con hechos observables.\n\nEjemplo: “Considero importante la biblioteca comunal porque ofrece libros y un lugar tranquilo para estudiar”. La posición es valorar la biblioteca. La razón explica el beneficio que brinda.\n\nDistingue entre lo que el texto afirma y lo que tú interpretas. Si no hay información suficiente, evita presentar una suposición como un hecho. Escucha otras opiniones y responde con respeto.\n\nActividad: escribe una opinión sobre una mejora que necesita tu escuela. Añade dos razones y una observación que las respalde. Revisa si alguien que piensa diferente puede comprender tus argumentos.'
  }
];

const quizSeeds = [
  { id: 'quiz-ciencias', courseId: 'ciencias', title: 'Comprueba lo aprendido sobre el agua', questions: [
    { prompt: '¿Qué provoca principalmente la evaporación en el ciclo del agua?', options: ['El calor del Sol', 'Los residuos del río', 'El movimiento de las piedras'], correctIndex: 0 },
    { prompt: 'Cuando el vapor se enfría y forma nubes, ocurre la…', options: ['Precipitación', 'Condensación', 'Infiltración'], correctIndex: 1 },
    { prompt: '¿Qué acción ayuda a proteger una fuente de agua?', options: ['Arrojar residuos al río', 'Retirar toda la vegetación', 'Conservar los árboles y evitar contaminar'], correctIndex: 2 }
  ] },
  { id: 'quiz-matematica', courseId: 'matematica', title: 'Practica porcentajes y proporciones', questions: [
    { prompt: '¿Cuánto es el 10 % de S/ 80?', options: ['S/ 10', 'S/ 8', 'S/ 72'], correctIndex: 1 },
    { prompt: 'Una mochila cuesta S/ 60 y tiene 25 % de descuento. ¿Cuál es su precio final?', options: ['S/ 15', 'S/ 35', 'S/ 45'], correctIndex: 2 },
    { prompt: 'Si 4 personas necesitan 2 tazas de arroz, ¿cuántas necesitan 8 personas?', options: ['4 tazas', '2 tazas', '8 tazas'], correctIndex: 0 }
  ] },
  { id: 'quiz-comunicacion', courseId: 'comunicacion', title: 'Lee, comprende y argumenta', questions: [
    { prompt: '¿Qué expresa la idea principal de un texto?', options: ['Un detalle secundario', 'El mensaje central', 'Solo su primera palabra'], correctIndex: 1 },
    { prompt: '¿Qué ayuda a sostener una opinión?', options: ['Razones y evidencia relacionada', 'Repetirla sin explicaciones', 'Ignorar otras posiciones'], correctIndex: 0 },
    { prompt: 'Si el texto no da información suficiente, conviene…', options: ['Inventar un dato', 'Presentar una suposición como hecho', 'Reconocer lo que no se puede asegurar'], correctIndex: 2 }
  ] }
];

export function seed(db) {
  if (db.prepare('SELECT COUNT(*) AS n FROM users').get().n) return;
  const now = new Date().toISOString();
  db.exec('BEGIN');
  try {
    const user = db.prepare('INSERT INTO users (id,name,email,role,password_hash) VALUES (?,?,?,?,?)');
    user.run('alumno-demo', 'Valeria Quispe', 'alumno@aularaiz.local', 'student', passwordHash('Alumno2026!'));
    user.run('docente-demo', 'Roberto Alejandro Cardenas Curisinche', 'docente@aularaiz.local', 'teacher', passwordHash('Docente2026!'));
    for (const course of courses) db.prepare('INSERT INTO courses(id,data) VALUES (?,?)').run(course.id, JSON.stringify(course));
    for (const m of materialSeeds) {
      const material = { ...m, version: 1, assetUrl: null, filename: null, size: Buffer.byteLength(m.body), mimeType: 'text/plain', updatedAt: now };
      db.prepare('INSERT INTO materials(id,course_id,version,data) VALUES (?,?,?,?)').run(m.id, m.courseId, 1, JSON.stringify(material));
    }
    for (const quiz of quizSeeds) {
      const data = { ...quiz, version: 1, updatedAt: now };
      db.prepare('INSERT INTO quizzes(id,course_id,version) VALUES (?,?,1)').run(quiz.id, quiz.courseId);
      db.prepare('INSERT INTO quiz_versions(quiz_id,version,data) VALUES (?,?,?)').run(quiz.id, 1, JSON.stringify(data));
    }
    db.exec('COMMIT');
  } catch (err) { db.exec('ROLLBACK'); throw err; }
}
