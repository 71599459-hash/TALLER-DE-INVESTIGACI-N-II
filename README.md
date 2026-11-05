# AulaRaíz

Aplicación educativa local para consultar materiales y resolver cuestionarios con o sin conexión.

## Tecnologías

Interfaz: HTML, CSS y JavaScript. Servidor: Node.js. Datos del servidor: SQLite. Uso sin conexión: IndexedDB, Cache API y Service Worker. Instalación: PWA en navegadores compatibles.

## Ejecutar

Se necesita Node.js 22.13 o posterior.

```sh
npm start
```

Abre `http://localhost:4173` en Chrome o Edge. El servidor crea cursos y usuarios de demostración en el primer inicio. Consulta las cuentas de prueba en [server/README.md](server/README.md).

## Uso sin conexión

Inicia sesión con acceso al servidor y descarga el curso que quieras estudiar. Las lecturas y actividades descargadas quedan disponibles en el dispositivo. Los cuestionarios y avances pendientes se envían cuando la aplicación abierta recupera acceso al servidor local. Tener internet no basta si la computadora que ejecuta Node.js está apagada o desconectada.

## Pruebas

```sh
npm run verify
```

La prueba de navegador `tests/e2e.mjs` requiere Playwright y un navegador compatible. Debe probarse por separado en un celular real antes de usarlo en una exposición o demostración presencial.

## Protección de los datos

Es una versión académica de demostración. No utilices información de alumnos reales con las cuentas incluidas. Las carpetas `data`, `data-debug`, `respaldos`, `logs` y `certs` contienen datos de ejecución que no deben publicarse en GitHub. Realiza una copia de seguridad de la carpeta `data` antes de actualizar una instalación existente.

Para uso institucional faltan cuentas individuales, permisos por curso y configuración HTTPS confiable.
