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
- `server/`: API, sesiones, base SQLite y datos iniciales.
- `tests/`: pruebas de API y navegador.
- `scripts/`: comandos de ejecución, HTTPS y respaldo en Windows.
- `.devcontainer/`: entorno de GitHub Codespaces.

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
