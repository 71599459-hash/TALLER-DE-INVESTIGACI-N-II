# Estado de implementación de AulaRaíz

Esta matriz contrasta el backlog propuesto con la revisión del código local realizada el 4 de noviembre de 2026. “Implementado en código” significa que existe la operación o interfaz correspondiente; no equivale a un criterio aprobado mediante pruebas. Las evidencias y resultados de ejecución deben consultarse en el informe de pruebas que acompaña la aplicación y completarse con las validaciones pendientes.

Archivos revisados: `server/index.mjs`, `server/seed.mjs`, `public/app.js`, `public/db.js` y `public/sw.js`.

Ejecución confirmada por la coordinación técnica: `npm test`, nueve pruebas registradas por el ejecutor de Node aprobadas y cero fallos. La estructura de `server/api.test.mjs` contiene una prueba principal y ocho subpruebas de API que abarcan acceso y permisos, exclusión de claves al alumno, conservación de versiones de cuestionario, calificación de versión anterior, idempotencia y conflicto de carga, rechazo parcial de eventos, persistencia tras reinicio, publicación y rangos de archivos, exportación y protección de rutas.

La revisión final de navegador registra diecisiete comprobaciones aprobadas y cero excepciones JavaScript. Se comprobó la descarga, recarga con red deshabilitada, lectura, recuperación de borrador, conservación de dos eventos pendientes, reconexión con nota 3 de 3 e idempotencia. También se publicaron una lectura, un cuestionario y un video WebM real de prueba desde los formularios docentes; se recibió la actualización automáticamente al reingresar y se reprodujo el Blob sin conexión. El diseño se verificó en escritorio y a 390 píxeles de ancho. Los datos son temporales y los resultados académicos son de demostración. Las evidencias y hashes de los archivos probados se encuentran en `tests/evidence/RESULTADO_E2E.md` y `results.json`; estas pruebas no sustituyen la instalación y prueba en un celular físico.

| Historia | Implementado en código | Alcance o validación pendiente |
| --- | --- | --- |
| HU01 Acceso por rol | Dos cuentas semilla; acceso por correo y contraseña; sesiones de servidor y vistas docente/alumno | Sin registro, gestión de usuarios ni recuperación de contraseña. Validar renovación de sesión con trabajo pendiente |
| HU02 Catálogo | Tres cursos de ejemplo; búsqueda y navegación a su conjunto de materiales y cuestionarios | Sin gestión de cursos ni matrícula. Todo usuario autenticado ve el catálogo de esta demostración |
| HU03 Materiales | Publicación y edición docente de lecturas y archivos; versiones numéricas de materiales | Solo se conserva en la tabla la versión actual del material; comprobar límites, errores y archivos con datos de prueba |
| HU04 Videos | Subida de MP4/WebM de hasta 20 MB; descarga del archivo como Blob y reproductor local | No hay videos precargados. Publicar archivo autorizado y verificar reproducción offline en cada dispositivo objetivo |
| HU05 Cuestionarios | Editor docente de 1 a 10 preguntas y tres opciones por pregunta; API admite más opciones y hasta 30 preguntas; clave excluida del catálogo del alumno | La interfaz crea cuestionarios; edición/versionado existente se realiza mediante la API, no mediante un editor de cuestionarios previos en pantalla |
| HU06 Descarga | Descarga explícita del curso como unidad con materiales, cuestionarios y Blob; confirma después de guardar el paquete en IndexedDB | Validar descarga interrumpida y cuota insuficiente. La unidad de la interfaz corresponde al curso; no hay tabla de unidades independientes |
| HU07 Recursos offline | Shell mediante Service Worker; lecturas y archivos del paquete local; apertura de video desde URL de objeto Blob | Verificar recarga offline, reapertura completa y reproducción física en móvil. Requiere preparación y descarga previas |
| HU08 Cuestionario offline | Borrador por usuario/cuestionario/versión; intento persistente con UUID; la respuesta final se guarda en outbox | Validar conservación tras cierre/reapertura y recuperación de errores de almacenamiento. La calificación se obtiene del servidor |
| HU09 Avance local | Marcación de material completado; evento pendiente; estado combinado con el progreso recibido del servidor | Es un avance manual por material, no medición automática de minutos de estudio ni seguimiento detallado de reproducción |
| HU10 Sincronización | Envío de pendientes; respuesta accepted/rejected; recibo idempotente con hash de carga; reintento manual y con app abierta | Validar caída después de recepción y antes de respuesta. No se promete sincronización con la app cerrada |
| HU11 Actualizaciones | Detección de cambios en versiones y número de recursos; actualización de descargas; histórico de quiz_versions para intentos anteriores | Sin histórico completo de versiones de materiales. La actualización de cuestionarios existentes está en API; comprobar el recorrido de versión anterior pendiente |
| HU12 Consulta docente | Vista de intentos sincronizados y su calificación; exportación de registros mediante API docente | El reporte visible se centra en intentos. No muestra un tablero completo del progreso por material de otros alumnos |
| HU13 Seguridad | Contraseñas con scrypt y sal; hash de tokens; autorización docente en publicaciones; intentos del alumno filtrados por su usuario; SQL parametrizado; recibos vinculados al usuario | No existen permisos por curso, inscripción, recuperación de acceso, gestión de cuentas ni separación institucional. Las cuentas demo no son configuración de producción |
| HU14 Adaptación y accesibilidad | Diseño responsive, etiquetas, nombres accesibles, foco/modal y navegación por teclado previstos en la interfaz | Revisión de teclado completa, lector de pantalla, contraste y anchos reales debe registrarse; no se declara conformidad WCAG certificada |
| HU15 Resiliencia | Límite de espera de red; outbox persistente; errores recuperables; confirmación antes de retirar pendientes; estimación y petición de persistencia de almacenamiento | Rendimiento y estrés no se deducen del código. Medir umbral propuesto de 2 segundos, fallo de cuota, sesión vencida y restauración desde respaldo |

## Datos de ejemplo y archivos

La semilla define dos usuarios ficticios de demostración, tres cursos, seis lecturas y tres cuestionarios. El perfil docente utiliza el nombre de Roberto Alejandro Cardenas Curisinche; los resultados generados con estas cuentas no representan una población de alumnos reales. Los videos y otros archivos deben publicarse por el docente y se guardan en `data/uploads`.

SQLite contiene las tablas `users`, `sessions`, `courses`, `materials`, `quizzes`, `quiz_versions`, `attempts`, `progress` y `event_receipts`. IndexedDB contiene `kv`, `downloads`, `outbox` y `drafts`. Cache API conserva el shell de la aplicación. Los archivos de la carpeta local y los datos del navegador cumplen funciones distintas y necesitan medidas de respaldo apropiadas.

## Instalación y uso real

La aplicación es una PWA local. En PC se abre desde localhost y puede instalarse con un navegador compatible. La instalación en celular por LAN requiere servidor accesible, HTTPS y certificado confiable en el dispositivo. La comprobación física de instalación y modo avión sigue pendiente hasta que exista una evidencia registrada del celular utilizado.

La sincronización necesita acceso al servidor que corre en la PC, incluso si el dispositivo ya tiene internet. Si el PC está apagado, fuera de la red o bloqueado por la configuración de conectividad, los intentos permanecen locales para reintentar. Instalar la PWA no instala automáticamente el servidor en el celular.

Antes de usar información de alumnos reales deben completarse la gestión de cuentas, recuperación de acceso, autorización por curso, respaldo y restauración, configuración HTTPS y pruebas en los dispositivos objetivo. Esta versión local permite avanzar y demostrar el recorrido académico con datos de ejemplo; no se debe describir como plataforma institucional de producción validada.
