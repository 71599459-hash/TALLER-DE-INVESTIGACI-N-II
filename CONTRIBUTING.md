# Colaboración en AulaRaíz

Este repositorio contiene la aplicación web, su servidor Node.js y las pruebas. Cada integrante trabaja con su propia copia de los archivos locales de SQLite.

## Preparación inicial

1. Clona el repositorio y abre la carpeta en Visual Studio Code.
2. Instala Node.js 22.13 o posterior (se recomienda Node.js 24).
3. Ejecuta `npm start` y abre `http://127.0.0.1:4173/`.
4. Para usar el panel de administración, detén el servidor, ejecuta una sola vez `npm run admin:init` e inicia nuevamente.
5. Ejecuta `npm run verify` antes de enviar cambios.

Las credenciales de demostración están documentadas en [server/README.md](server/README.md). Para una instalación real deben sustituirse por cuentas seguras.

## Organización del trabajo en Git

Trabaja en una rama separada por cada cambio:

```sh
git switch main
git pull --ff-only origin main
git switch -c feature/descripcion-del-cambio
```

Después de modificar y comprobar el código:

```sh
npm run verify
git add .
git commit -m "feat: descripcion clara del cambio"
git push -u origin feature/descripcion-del-cambio
```

Abre una **Pull Request** hacia `main` para que otro integrante revise la modificación. Si no tienes permisos para enviar ramas a este repositorio, solicita acceso de colaborador o crea una bifurcación (fork) y abre la solicitud desde ella. Evita trabajar directamente en `main` y no fuerces publicaciones que reescriban su historial.

Antes de comenzar otra tarea, actualiza tu copia con `git pull --ff-only origin main`. Si tienes cambios locales, confírmalos en un commit o guárdalos temporalmente antes de actualizar.

## Archivos que deben permanecer en cada computadora

- `data/`: SQLite, archivos adjuntos y datos reales de ejecución.
- `respaldos/`, `logs/`, `certs/`: copias, registros y certificados locales.
- `node_modules/` y los resultados generados en `tests/evidence/`.

Estos archivos no deben subirse al repositorio. `git pull` y `git push` sincronizan **código**, no las bases de datos de cada integrante. Para compartir datos de prueba, utiliza una copia anonimizada y un canal privado.

Para crear un respaldo consistente, detén primero el servidor y ejecuta `npm run respaldar` desde la raíz del proyecto. El respaldo incluye credenciales protegidas y no debe publicarse.

## Pruebas y revisión

- `npm run verify`: comprobación de sintaxis y pruebas automáticas de API, cuentas y sesiones.
- `npm run test:e2e`: prueba de navegador; requiere `npm install` y `npx playwright install chromium`.
- Comprobar manualmente el inicio de sesión, el perfil administrador, los permisos por curso y la sincronización sin conexión antes de cerrar un cambio funcional.
- Evitar cambios simultáneos sobre la misma base SQLite desde el servidor y DB Browser. Para editar externamente, detener el servidor, respaldar los datos y guardar con **Write Changes**.

## Guía técnica

Consulta [documentacion/ARQUITECTURA.md](documentacion/ARQUITECTURA.md) para identificar los archivos responsables de cada función, las tablas de SQLite y el proceso de sincronización. La documentación de los endpoints está en [server/README.md](server/README.md).
