# Guion propuesto para el video de avance del PA1

La consigna PA1 pide un video de máximo diez minutos, con un resumen sustentado por todos los integrantes y enlace de YouTube. El siguiente guion dura aproximadamente nueve minutos y cincuenta segundos. Es una propuesta para grabar entre cuatro personas; no acredita que el video ya exista ni que la aplicación esté validada en todos los dispositivos.

El grupo ha indicado que la aplicación se expone en PA4. En el video PA1 puede mostrarse brevemente el prototipo como avance, sin sustituir la explicación del problema, objetivos, organización y backlog. El PA2 añade diseño técnico, métricas, aceptación y pruebas; su consigna proporcionada no exige explícitamente un video nuevo.

## Preparación antes de grabar

1. Iniciar el proyecto local con el archivo de inicio que acompaña la aplicación y abrir la dirección indicada; en PC, `http://localhost:4173`.
2. Usar un navegador o perfil para el docente y otro para el alumno. Evitar el modo privado para demostrar persistencia entre sesiones. Las cuentas son de demostración y no representan usuarios reales de una institución.
3. Abrir como docente con `docente@aularaiz.local` y contraseña `Docente2026!`. Abrir como alumno con `alumno@aularaiz.local` y contraseña `Alumno2026!`.
4. Si se demostrará video, publicar previamente un MP4 o WebM propio o autorizado, compatible y de menos de 20 MB. No hay video precargado en los datos de ejemplo. Un enlace de YouTube no es un archivo descargable de esta aplicación.
5. En alumno, descargar la unidad de Ciencias y esperar la confirmación completa. Comprobar que la aplicación está controlada por su Service Worker antes de desconectar.
6. Preparar la herramienta Network del navegador para activar el modo Offline y mostrar la desconexión en pantalla. No borrar datos del sitio durante la grabación.
7. Tener a la vista tres diapositivas breves: problema y objetivos; equipo y épicas; backlog con ejemplos de historias y tareas. Preparar una cuarta diapositiva con arquitectura y pendientes si hay tiempo.
8. Hacer un ensayo. Si un paso falla, registrar la incidencia y corregir antes de grabar; no editar el relato para presentar como aprobado un caso fallido. El resultado del ensayo debe anotarse aparte.

## Distribución de las cuatro voces

Los nombres de los otros tres integrantes deben completarse con los reales. La plantilla entregada no los contiene.

| Tiempo | Voz propuesta | Contenido y pantalla |
| --- | --- | --- |
| 0:00–2:00 | Integrante 2, análisis y Product Owner propuesto | Problema, tres causas, objetivo general, dos indicadores y objetivos específicos; diapositiva 1 |
| 2:00–4:00 | Integrante 3, coordinación Scrum propuesta | Alcance, organización, tres épicas y backlog de quince historias con tres RNF y cuatro tareas por historia; diapositivas 2 y 3 |
| 4:00–7:10 | Roberto Alejandro Cardenas Curisinche, desarrollo | Tecnología y demostración breve de descarga, desconexión, intento pendiente y sincronización; aplicación local |
| 7:10–9:30 | Integrante 4, calidad propuesta | Explicar criterios, cuatro tipos de prueba, evidencias y pendientes de validación; diapositiva 4 y vista de resultados |
| 9:30–9:50 | Integrante 2 o integrante que coordine | Próximo incremento, reparto acordado y cierre del avance |

## Texto orientativo para cada intervención

### Primera voz

“Nuestro proyecto propone dar continuidad al estudio de alumnos con conectividad intermitente. Identificamos tres causas: cobertura inestable, dependencia permanente de plataformas en línea y falta de almacenamiento local de respuestas. El objetivo es desarrollar AulaRaíz para publicar y descargar contenidos, estudiar sin conexión y sincronizar después. Mediremos la proporción de recorridos offline aprobados y la recepción de los intentos sin pérdida ni duplicados. Estas son metas de validación y todavía deben medirse; no son resultados de una encuesta. Los objetivos específicos se relacionan con definir el backlog, habilitar la descarga, conservar las respuestas y ejecutar las pruebas antes de la exposición.”

Adaptar el texto a la institución y población reales cuando el equipo tenga evidencia de investigación. No atribuir los ejemplos de Ciencias, Matemática y Comunicación a una institución participante.

### Segunda voz

“El alcance incluye publicación de lecturas, archivos, videos y cuestionarios; descarga; trabajo offline; avance local; y sincronización con el servidor. Hemos planteado tres épicas: publicación educativa, aprendizaje sin conexión, y sincronización y calidad. El backlog contiene quince historias, tres de requisitos no funcionales, con sesenta tareas y treinta criterios para desarrollar el PA2. Por ejemplo, HU08 permite responder un cuestionario descargado y conservarlo pendiente después de recargar. Organizamos el trabajo en cuatro sprints propuestos. Los roles y responsables mostrados deben corresponder a nuestros acuerdos finales en Trello.”

Mostrar una historia real del backlog y sus cuatro tareas. Explicar un criterio sin intentar leer las quince historias completas.

### Tercera voz y demostración de Roberto

“Esta aplicación se ejecuta en nuestra carpeta local. La interfaz utiliza HTML, CSS y JavaScript; el servidor, Node.js y SQLite. IndexedDB conserva las unidades, archivos y respuestas en el dispositivo; el Service Worker prepara la interfaz para reabrirla sin conexión. Primero hay que iniciar sesión y descargar. Después la red puede interrumpirse y el trabajo permanece guardado. La calificación se confirma cuando responde el servidor.”

Recorrido de unos tres minutos:

1. Mostrar la dirección local y la cuenta alumno. Abrir Ciencias. Señalar que la unidad ya se descargó durante la preparación o descargarla en ese momento y esperar la confirmación visible.
2. Activar Offline en Network. Recargar la página. Mostrar el estado de desconexión y abrir una lectura descargada. Si se preparó un video, abrirlo brevemente y comprobar reproducción; no anunciar que funciona si no se reproduce.
3. Resolver las tres preguntas del cuestionario y pulsar Guardar mis respuestas. Abrir el Centro de sincronización y mostrar el intento como pendiente. Explicar que todavía no fue recibido ni calificado por el servidor.
4. Recargar y mostrar que el pendiente se conserva. La navegación puede volver al inicio según la dirección utilizada; regresar al Centro de sincronización.
5. Desactivar Offline. Pulsar Sincronizar ahora si no se inicia automáticamente. Mostrar el resultado confirmado y la calificación devuelta por el servidor.
6. En el perfil docente, actualizar la vista para mostrar el intento recibido. No mostrarlo como resultado de un alumno real: se trata de la cuenta de ejemplo.

Si se quiere demostrar idempotencia de forma concluyente, utilizar también la evidencia técnica de reintentos y el registro único de SQLite. Pulsar varias veces el botón después de una sincronización exitosa no reproduce por sí solo el caso de recepción con respuesta perdida.

### Cuarta voz

“La aceptación se comprueba por escenarios Dado que, Cuando y Entonces. Para el trabajo offline verificamos descarga completa, reapertura sin red y conservación de respuestas. Para la sincronización verificamos confirmación, reintentos sin duplicados y procesamiento con la versión original del cuestionario. Aplicaremos pruebas unitarias con node:test, de integración con API y SQLite, funcionales de extremo a extremo en el navegador y de rendimiento con mediciones de navegador y k6 propuesto. Presentaremos los resultados realmente ejecutados y sus incidencias, sin mezclar los pendientes con aprobados. La instalación y el modo avión en un celular real necesitan una prueba física: por red local requieren HTTPS y un certificado confiable.”

Explicar también los límites de esta versión: cuentas de demostración, sin gestión de usuarios ni matrículas; el reporte docente muestra intentos sincronizados, y el seguimiento detallado del avance por alumno necesita ampliación de la interfaz. Los materiales de ejemplo son ficticios y no constituyen una validación de campo.

## Evidencia que conviene guardar

Para cada prueba, anotar fecha, versión del código, equipo y navegador, datos usados, pasos, resultado esperado y obtenido, estado aprobado o fallido y responsable. Guardar una captura del pendiente sin red y otra de la confirmación posterior. Para video, registrar nombre, tamaño y formato del archivo usado. Para instalación en celular, registrar sistema, navegador, origen HTTPS, confianza del certificado y funcionamiento después de cerrar y reabrir en modo avión.

El guion no incorpora resultados nuevos de pruebas. Añadir los resultados solo después de ejecutar y revisar cada caso. El enlace de YouTube y los nombres de los participantes deben completarse después de grabar y publicar el video conforme a la consigna.
