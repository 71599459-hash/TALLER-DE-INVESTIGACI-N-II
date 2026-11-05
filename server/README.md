# API local de AulaRaíz

El servidor usa módulos incluidos en Node.js y SQLite integrado. No necesita instalar paquetes npm ni acceder a servicios externos. Requiere Node.js 22.13 o posterior; se verificó con Node.js 24.11.1.

## Ejecución

Desde la raíz del proyecto, junto a `package.json`, ejecutar `npm start` o `node server/index.mjs`. La aplicación se sirve en `http://localhost:4173` y la base de datos se crea en `data/aularaiz.sqlite`. El servidor escucha en todas las interfaces para admitir equipos de la misma red. La instalación PWA en un celular requiere HTTPS con un certificado confiable; la dirección HTTP de la red local no proporciona por sí sola esa condición.

Variables opcionales: `PORT`, `AULARAIZ_DATA_DIR`, `HTTPS_CERT` y `HTTPS_KEY`. Si se proporcionan los dos archivos TLS, el puerto predeterminado es 4174. No se genera ni confía automáticamente un certificado.

## Cuentas de demostración

| Rol | Correo | Contraseña |
| --- | --- | --- |
| Estudiante | alumno@aularaiz.local | Alumno2026! |
| Docente | docente@aularaiz.local | Docente2026! |

Son cuentas para la exposición académica. El nombre de la estudiante es ficticio. El acceso de usuarios reales y su administración requieren una fase posterior de preparación y validación.

## Contratos

Las rutas protegidas usan `Authorization: Bearer TOKEN`. El inicio de sesión devuelve un token aleatorio con vigencia de 30 días; SQLite conserva únicamente su hash. Las contraseñas se almacenan con una sal aleatoria y scrypt. No se usan cookies ni servicios de identidad externos.

| Método y ruta | Uso |
| --- | --- |
| GET /api/health | Disponibilidad y versión del servidor |
| POST /api/login | Correo y contraseña; devuelve token, usuario y vencimiento |
| POST /api/logout | Revoca la sesión actual |
| GET /api/bootstrap | Cursos, materiales, cuestionarios, intentos y avance del usuario |
| POST /api/materials | Publicar o editar un material; exige docente |
| POST /api/quizzes | Publicar o editar un cuestionario; exige docente |
| POST /api/sync | Confirmar intentos y avances del estudiante |
| GET /api/assets/archivo | Obtener un archivo con autenticación y rangos HTTP |
| GET /api/export | Exportar registros académicos JSON; exige docente |

Los roles técnicos son `student` y `teacher`. Los errores devuelven JSON con la propiedad `error`. El bootstrap del estudiante omite el índice de respuesta correcta. El docente puede consultar los intentos de todas las cuentas de demostración; cada estudiante recibe únicamente sus intentos.

### Materiales

`POST /api/materials` recibe `courseId`, `title`, `description`, `type` y, según el tipo, `body` o `file`. Para editar se añade `id`; la versión aumenta en cada actualización.

`type` puede ser `article`, `file` o `video`. El cuerpo de un artículo es texto plano de hasta 100 000 caracteres. Un archivo se transmite como `{name, type, data}`, donde `data` es base64 sin el prefijo de una URL de datos. Se admite un máximo de 20 MB por archivo. Los tipos admitidos son PDF, TXT, PNG, JPG, MP4 y WebM. Las cabeceras de MP4 y WebM se comprueban antes de publicar. No se transcodifican videos.

El resultado contiene `id`, `courseId`, `title`, `description`, `type`, `body`, `version`, `assetUrl`, `filename`, `size`, `mimeType` y `updatedAt`. El cliente descarga el archivo con su token y lo conserva como Blob para el acceso sin conexión.

### Cuestionarios

`POST /api/quizzes` recibe `courseId`, `title` y `questions`, además de `id` si es una edición. Cada pregunta contiene `prompt`, `options` y `correctIndex`. Se admiten entre 1 y 30 preguntas y de 2 a 6 opciones por pregunta.

Cada actualización crea una versión inmutable en `quiz_versions`. La versión anterior permanece disponible para calificar respuestas de estudiantes que descargaron ese cuestionario antes de la edición.

### Sincronización

`POST /api/sync` recibe hasta 100 eventos con esta estructura:

```json
{
  "events": [
    {
      "id": "identificador-estable-del-dispositivo",
      "type": "attempt",
      "createdAt": "2026-11-04T20:00:00.000Z",
      "payload": {
        "quizId": "quiz-ciencias",
        "quizVersion": 1,
        "answers": [0, 1, 2]
      }
    }
  ]
}
```

Un evento `progress` usa `payload: {materialId, courseId, completed}`. El servidor es la autoridad para la hora de recepción y la calificación. Las fechas y calificaciones que envíe el cliente no se aceptan como resultados válidos.

Cada evento confirmado se guarda junto con un recibo y un hash de su contenido en una transacción SQLite. Repetir el mismo identificador y contenido devuelve la confirmación anterior con `duplicate: true`; no genera otro intento. Reutilizar un identificador con contenido diferente produce un rechazo 409. Los eventos válidos del lote se confirman aunque otro evento sea rechazado.

La respuesta es `{accepted, rejected, serverTime}`. El cliente debe quitar de su cola únicamente los identificadores incluidos en `accepted`. Un evento rechazado permanece pendiente para revisión o reintento. Un resultado de intento contiene `attemptId`, `quizId`, `quizVersion`, `score`, `total`, `percentage` y `submittedAt`.

El avance de un material se resuelve por orden de recepción en el servidor. No se implementa fusión colaborativa de ediciones simultáneas. La sincronización se ejecuta cuando la aplicación abierta recupera acceso al servidor; recuperar internet sin alcanzar la PC que aloja el servidor no basta.

## Persistencia y respaldo

Tablas: `users`, `sessions`, `courses`, `materials`, `quizzes`, `quiz_versions`, `attempts`, `progress` y `event_receipts`. La integridad usa claves foráneas y transacciones. SQLite trabaja en modo WAL.

La exportación de registros omite hashes de contraseñas y sesiones; no incluye los archivos binarios. Para un respaldo íntegro, detener el servidor y copiar toda la carpeta `data`, incluidos `uploads` y cualquier archivo SQLite asociado. Conservar el respaldo como información privada.

## Verificación

`npm test` ejecuta pruebas API aisladas en una carpeta temporal. Comprueba acceso por rol, ausencia de claves de corrección en el estudiante, versiones históricas, reintentos idempotentes, rechazo parcial, conservación tras reiniciar SQLite, subida y rangos de archivos, exportación sin claves y restricciones de rutas estáticas. No modifica los datos de trabajo.

Estas pruebas no sustituyen una prueba física en modo avión, una revisión de accesibilidad ni la validación de instalación en cada sistema operativo. La aplicación académica tampoco incluye administración de cuentas, inscripciones por curso, cuotas por usuario, recuperación de contraseña ni operación de producción.
