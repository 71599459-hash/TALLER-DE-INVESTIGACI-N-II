# AulaRaíz

Aplicación educativa local para consultar materiales y resolver cuestionarios con o sin conexión.

## Abrir la aplicación desde GitHub

**[Abrir AulaRaíz en GitHub Codespaces](https://codespaces.new/71599459-hash/TALLER-DE-INVESTIGACI-N-II?quickstart=1)**

1. Inicia sesión en GitHub y selecciona **Create codespace** (o reanuda uno existente).
2. Se preparará el entorno de Node.js 24 y se iniciará automáticamente el servidor de AulaRaíz.
3. GitHub puede abrir la aplicación directamente. Si no lo hace, abre la pestaña **Ports / Puertos** y selecciona el enlace del puerto **4173** (AulaRaíz — aplicación).
4. Entra con la cuenta de demostración. Los accesos de estudiante y docente están en [server/README.md](server/README.md).

El puerto se mantiene **privado** por defecto: conserva así esa configuración. La dirección abierta será un enlace HTTPS de GitHub Codespaces, no `localhost` en tu PC. Puedes probar el inicio de sesión, los materiales, los cuestionarios, las descargas y la sincronización. Para comprobar el modo sin conexión, descarga una unidad antes de desactivar la red.

Codespaces es un **entorno temporal de pruebas**, no un alojamiento público permanente. Los datos guardados allí son independientes de los de tu PC. No ingreses información real de estudiantes. Si eliminas el codespace, también puedes perder sus datos. Los Codespaces pueden consumir la cuota incluida en GitHub o generar costos según la cuenta.

## Tecnologías

Interfaz: HTML, CSS y JavaScript. Servidor: Node.js. Datos del servidor: SQLite. Uso sin conexión: IndexedDB, Cache API y Service Worker. Instalación: PWA en navegadores compatibles.

## Ejecutar en tu propia PC

Se necesita Node.js 22.13 o posterior.

```sh
npm start
```

Abre `http://localhost:4173` en Chrome o Edge. El servidor crea cursos y usuarios de demostración en el primer inicio. Consulta las cuentas de prueba en [server/README.md](server/README.md).

## Inicio de sesión

Al abrir AulaRaíz en una pestaña nueva se solicitan las credenciales. Cuando el servidor está disponible, abrir o recargar AulaRaíz muestra siempre el formulario de acceso. La sesión temporal permite continuar con actividades ya descargadas únicamente cuando el navegador no puede contactar al servidor.

Los cursos descargados, borradores y avances pendientes se mantienen en IndexedDB por usuario. Cerrar sesión no los elimina: ingresa con la misma cuenta para recuperarlos.

## Estructura del proyecto

- `public/`: interfaz web, estilos, almacenamiento local y caché PWA.
- `server/`: API, sesiones, cuentas administradas, base SQLite y datos iniciales.
- `tests/`: pruebas de API y navegador.
- `scripts/`: comandos de ejecución, HTTPS y respaldo en Windows.
- `.devcontainer/`: entorno de GitHub Codespaces.

## Administración de usuarios y cursos

El sistema incluye un perfil administrador independiente en la interfaz. La información se guarda en la misma base SQLite `data/aularaiz.sqlite`; no necesitas instalar otro gestor de base de datos. El administrador puede crear alumnos y docentes, modificar sus datos, restablecer contraseñas, habilitar o deshabilitar accesos y asignar cursos específicos. En **Administración → Cambiar mi contraseña** puede modificar su propia clave indicando la anterior; en la lista de usuarios, **Restablecer contraseña** permite asignar una nueva clave a cualquier alumno o docente. Los cambios se guardan de inmediato en SQLite y se revocan las sesiones anteriores de la cuenta afectada.

Para preparar tu cuenta administradora la primera vez, desde la carpeta del proyecto ejecuta:

```sh
npm run admin:init
```

Escribe tu nombre, correo y una contraseña de al menos 10 caracteres (en la terminal se muestran asteriscos). Después ejecuta `npm start` e inicia sesión con esa cuenta. En el menú lateral se mostrará **Administración**. Los alumnos y docentes existentes se conservan, junto con sus cursos y resultados; los alumnos creados después empiezan sin cursos asignados.

**Seguridad:** no compartas la contraseña del administrador ni publiques el archivo SQLite. El panel no elimina estudiantes ni sus calificaciones: deshabilitar una cuenta bloquea el acceso y revoca las sesiones. Si eliminas un curso asignado, el alumno no podrá consultarlo ni sincronizar nuevos eventos de ese curso; contenido previamente descargado en un dispositivo completamente desconectado no puede revocarse hasta que recupere la conexión. Para operar por internet o con datos reales se requiere HTTPS y revisar la política de usuarios.

### Uso junto con DB Browser for SQLite

Ambas herramientas utilizan el archivo `data/aularaiz.sqlite`. Si editas un nombre o estado desde DB Browser, pulsa **Write Changes** y luego **Actualizar** en Administración para releer SQLite. No necesitas modificar el código en Visual Studio Code. Para modificar datos con seguridad, detén primero el servidor y realiza una copia de respaldo de la carpeta `data`.

Las contraseñas **no se escriben en texto plano** en la columna `users.password_hash`; se guardan con scrypt y una sal única. Utiliza **Cambiar mi contraseña** o **Restablecer contraseña** desde AulaRaíz para actualizarlas correctamente. No borres las tablas originales ni modifiques los identificadores de usuario.

## Uso sin conexión

Inicia sesión con acceso al servidor y descarga el curso que quieras estudiar. Las lecturas y actividades descargadas quedan disponibles en el dispositivo. Los cuestionarios y avances pendientes se envían cuando la aplicación abierta recupera acceso al servidor local. Tener internet no basta si la computadora que ejecuta Node.js está apagada o desconectada.

## Pruebas

```sh
npm run verify
```

Para ejecutar la prueba de interfaz con Chromium:

```sh
npm install
npx playwright install chromium
npm run test:e2e
```

Puedes indicar la ruta de Chrome o Edge en la variable `AULARAIZ_BROWSER`. La prueba crea una base de datos temporal, genera los resultados en `tests/evidence` y no utiliza los datos de trabajo. La prueba en navegador emulado no sustituye la verificación en un celular real.

## Protección de los datos

Es una versión académica de demostración. No utilices información de alumnos reales con las cuentas incluidas. Las carpetas `data`, `data-debug`, `respaldos`, `logs` y `certs` contienen datos de ejecución que no deben publicarse en GitHub. Realiza una copia de seguridad de la carpeta `data` antes de actualizar una instalación existente.

Para uso institucional faltan cuentas individuales, permisos por curso y configuración HTTPS confiable.
