# Herramientas de mantenimiento

AulaRaíz conserva el servidor Node.js y la misma base de datos SQLite. Las tareas auxiliares también se ejecutan con JavaScript, dentro de esta carpeta.

## Ejecución

- `npm start`: inicia Node.js en primer plano; detener con `Ctrl+C`.
- `npm run iniciar`: inicia en segundo plano y registra el proceso en `logs/servidor.pid`; abre el navegador si el entorno lo admite.
- `npm run iniciar -- --sin-navegador`: inicia sin abrir el navegador.
- `npm run detener`: detiene únicamente la instancia cuyo identificador de servidor coincide con el registrado. Si detecta otra instancia en el puerto, no termina su proceso.

## Respaldo de la base de datos

Antes de ejecutar `npm run respaldar`, detén AulaRaíz y cierra las conexiones activas de DB Browser. La copia incluye la carpeta `data/` completa: SQLite, archivos cargados y archivos auxiliares. También crea un manifiesto `respaldo.json`.

Para elegir un destino externo:

```sh
npm run respaldar -- "D:\\MisRespaldos"
```

**Conserva los respaldos fuera del repositorio público.** Contienen datos de cuentas y sesiones; los archivos de respaldo no incluyen el almacenamiento IndexedDB de los navegadores.

Para restaurar: detén el servidor, conserva una copia de la carpeta `data/` actual y coloca en su lugar la carpeta `data/` del respaldo.

## HTTPS local

El generador de certificados utiliza **mkcert**. En Windows usa el ejecutable incluido en `tools/mkcert.exe`; en Linux y macOS requiere que `mkcert` esté disponible en el sistema. Configurar la confianza local requiere autorización explícita:

```sh
npm run https:configurar -- --confiar
npm run https:iniciar
```

Para definir manualmente las direcciones IPv4 válidas:

```sh
npm run https:configurar -- --confiar 192.168.1.100
```

Los certificados del servidor se generan en `certs/`. La clave privada de la autoridad queda fuera del proyecto; únicamente el certificado **público** de la autoridad se copia a `instalacion/AulaRaiz-CA.crt`. Los dos directorios generados están excluidos de GitHub. Nunca compartas `server-key.pem` ni `rootCA-key.pem`.

En un teléfono de la misma red abre `https://IP-DE-TU-PC:4174/`. La instalación y confianza de la autoridad en Android o iOS se configura manualmente en el equipo de prueba. No todos los sistemas consideran confiables automáticamente los certificados de usuario.

## Compatibilidad

Estas tareas no modifican la estructura de SQLite, la interfaz ni el proceso de sincronización. Codespaces mantiene su script de inicio de contenedor `.devcontainer/iniciar.sh`, que utiliza el mismo servidor Node.js.
