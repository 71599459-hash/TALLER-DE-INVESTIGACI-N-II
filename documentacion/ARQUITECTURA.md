# Arquitectura de AulaRaíz

## Componentes

La aplicación mantiene tres áreas de responsabilidad:

| Componente | Archivos | Responsabilidad |
| --- | --- | --- |
| Interfaz | `public/index.html`, `public/styles.css`, `public/app.js`, `public/admin.js` | Pantallas para estudiantes, docentes y administración |
| Cliente sin conexión | `public/db.js`, `public/sw.js`, `public/session.js` | IndexedDB, caché de la aplicación y sesiones en el navegador |
| Servidor y datos | `server/index.mjs`, `server/access.mjs`, `server/seed.mjs` | API REST, validación, permisos, cursos, SQLite y datos de demostración |

El navegador se comunica con Node.js mediante las rutas `/api/`. El servidor es el único componente que accede directamente a SQLite. Los usuarios no necesitan instalar DB Browser para usar AulaRaíz.

## Persistencia

- **SQLite:** `data/aularaiz.sqlite`. Guarda cuentas, sesiones, matrículas, cursos, materiales, cuestionarios, intentos, avances y recibos de sincronización.
- **Archivos:** `data/uploads/`. Contiene los recursos subidos por los docentes.
- **IndexedDB del navegador:** almacena copias descargadas, borradores, eventos pendientes y datos del último catálogo consultado.
- **Service Worker / Cache API:** permite cargar la interfaz sin conexión y gestionar los archivos estáticos de la PWA.

Las tablas de SQLite son `users`, `sessions`, `account_flags`, `course_enrollments`, `courses`, `materials`, `quizzes`, `quiz_versions`, `attempts`, `progress` y `event_receipts`. Las tablas `account_flags` y `course_enrollments` complementan la estructura original sin reemplazar registros existentes.

## Autenticación y permisos

El usuario inicia sesión con su correo y contraseña. Node.js verifica el hash de la contraseña y emite una sesión; SQLite conserva el hash del token. El perfil efectivo puede ser estudiante, docente o administrador.

- **Estudiante:** recibe únicamente los cursos asignados; sus avances e intentos se filtran por cuenta.
- **Docente:** publica contenido y consulta los resultados autorizados por la aplicación.
- **Administrador:** registra y habilita cuentas, restablece contraseñas y asigna cursos.

Los permisos se validan en el servidor. Ocultar un botón no constituye un control de acceso. La base local del navegador no es el repositorio principal de calificaciones confirmadas.

## Sincronización

1. Con acceso al servidor, el estudiante ingresa y descarga un curso.
2. Si pierde la conexión, consulta la copia almacenada en IndexedDB y continúa sus actividades.
3. Los eventos nuevos se incorporan a la cola local `outbox` con un identificador único.
4. Al recuperar acceso al servidor, el cliente envía los eventos a `POST /api/sync`.
5. El servidor valida el curso, registra los resultados en SQLite y devuelve confirmaciones.
6. El navegador elimina de la cola únicamente los eventos aceptados. `event_receipts` impide registrar el mismo evento dos veces.

Un cambio de permisos no puede retirar material que ya está almacenado en un dispositivo completamente desconectado; se aplicará cuando el estudiante vuelva a comunicarse con el servidor.

## Ejecución y desarrollo

- `npm start`: inicia Node.js en el puerto 4173.
- `npm run admin:init`: crea la cuenta administrativa local inicial sin incluir contraseñas en el repositorio.
- `npm run verify`: ejecuta verificaciones y pruebas con bases temporales.
- `npm run test:e2e`: ejecuta pruebas de navegador cuando Playwright y Chromium están instalados.
- `npm run iniciar`, `npm run detener` y `npm run respaldar`: gestionan el proceso local y los respaldos mediante Node.js.
- `npm run https:configurar -- --confiar` y `npm run https:iniciar`: habilitan HTTPS local mediante mkcert, con autorización explícita.

Cada equipo usa su propia carpeta `data/`, excluida de Git. Compartir el repositorio **no** sincroniza automáticamente los datos privados entre computadoras. Para un entorno común se necesitaría un servidor compartido con red, HTTPS, respaldo y controles de acceso adecuados.

Para detalles de la API y los respaldos, consulta [server/README.md](../server/README.md).
