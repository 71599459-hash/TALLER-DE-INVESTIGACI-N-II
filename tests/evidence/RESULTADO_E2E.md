# Resultado de pruebas de navegador

Fecha UTC: 2026-11-04T23:02:57.485Z

Estado: APROBADO

Navegador local: Edge o Chrome instalado, automatizado mediante Playwright. Datos aislados en una base temporal. Vista escritorio 1440 × 1080; vista móvil emulada 390 × 844.

- [x] Sin desbordamiento acceso escritorio: 1440px
- [x] Ingreso y descarga de unidad: Ciencias guardada en IndexedDB y Service Worker activo
- [x] Lectura sin conexión tras recarga: Lectura y marcado de avance desde almacenamiento local
- [x] Borrador de cuestionario persiste: Selección recuperada tras recarga sin conexión
- [x] Cola offline conservada: Intento y avance siguen pendientes con identificadores estables tras recarga
- [x] Sincronización y calificación reales: Un intento confirmado 3/3 (100%); reintento idempotente sin duplicar
- [x] Aislamiento de cuenta y resultados docentes: Docente no hereda descargas ni cola; ve el resultado del alumno con su nombre mediante permiso de docente
- [x] Publicación docente de lectura: Material persistido desde formulario y visible en tabla del servidor
- [x] Publicación de video real: 6658 bytes WebM cargados desde el formulario docente
- [x] Publicación docente de cuestionario: Pregunta con tres opciones y clave de respuesta guardada desde la interfaz
- [x] Sin desbordamiento docente móvil: 390px
- [x] Sin desbordamiento acceso móvil: 390px
- [x] Sin desbordamiento inicio móvil: 390px
- [x] Reproducción de video sin conexión: Blob local 320×180, reproducción avanza 0.32s
- [x] Sin desbordamiento video móvil: 390px
- [x] Actualización automática de materiales: Lectura y video nuevos disponibles en la unidad tras actualización y desconexión
- [x] Sin excepciones JavaScript de navegador



Errores JavaScript: 0. La emulación móvil no reemplaza una prueba en celular físico. La instalación real y la confianza del certificado HTTPS deben verificarse en el dispositivo antes de la exposición.
