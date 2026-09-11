# Rugby Board

Simulador de jugadas de rugby en el navegador. Cancha reglamentaria, jugadores que se arrastran,
recorridos dibujados a mano y animación por frames. Sin dependencias, sin build: es HTML, CSS y
JavaScript plano.

## Cómo abrirlo

Doble click en `index.html`. Nada más.

Para publicarlo online: Settings → Pages → Deploy from a branch → rama `main`, carpeta `/ (root)`.

## Pantallas

La app abre en el **inicio**: entrar con el mail, gestionar el club (equipos, cuerpo técnico,
código de invitación) y dos botones para arrancar, *Nueva jugada* y *Nueva situación*. Ahí también
están las jugadas y los set ups guardados, para abrirlos de una. La **pizarra** es la otra
pantalla, y se vuelve al inicio con el botón de arriba a la izquierda.

Entrar es opcional: *Entrar sin cuenta* lleva derecho a trabajar guardando en ese navegador.

## Cómo se usa

La jugada es una secuencia de **frames**. El frame 1 es la posición inicial; cada frame siguiente
describe adónde llega cada jugador y cuánto tarda. La animación interpola entre frames, siguiendo
el recorrido dibujado cuando hay uno, o en línea recta cuando no.

**Herramientas** (panel izquierdo, con atajo de teclado):

| Tecla | Herramienta | Qué hace |
|---|---|---|
| `V` | Mover | Arrastra jugadores. Doble click le da la pelota a uno. Arrastrar el fondo mueve la vista. |
| `R` | Carrera | Se dibuja desde un jugador: define su recorrido en el frame actual. |
| `P` | Pase | Click en el jugador que recibe. |
| `K` | Patada | Arrastrar desde el portador hasta donde cae la pelota. |
| `A` | Flecha | Flecha de referencia. |
| `C` | Cono | Marcador fijo (se mantiene en los frames siguientes). |
| `T` | Texto | Nota sobre la cancha. |
| `J` | Jugador | Click en la cancha suma un jugador al equipo elegido en el panel. |
| `E` | Borrar | Click sobre una ruta, flecha, cono o jugador para borrar su marca. |

Si dibujás un movimiento estando en el frame 1, se crea el frame 2 automáticamente: el primero
guarda solo la posición de partida.

**Otros atajos**: `Espacio` reproduce o pausa, `←` `→` cambian de frame, `N` agrega frame,
`Supr` borra la selección, `Ctrl+Z` deshace, `Ctrl+S` guarda, `F` entra al modo presentación
(`Esc` sale). La rueda del mouse hace zoom.

**Set ups**: el selector de arriba tiene las posiciones de partido, agrupadas:

| Grupo | Set ups |
|---|---|
| Salidas | mitad de cancha a favor y en contra, 22 a favor y en contra |
| Scrums | de izquierda a derecha, de derecha a izquierda, en mitad de cancha |
| Line-outs | line de 7, de 5 y de 4 (abren el escenario de line-out) |
| Estructuras | canal 3 Fuego, canal 3 Agua |
| Crear set up | cancha vacía, equipos alineados 1 a 15 |

Cada uno deja su descripción en la nota del primer frame. Aplicar uno reemplaza la jugada actual.

Los lados se nombran desde el equipo propio, que ataca hacia `x` creciente: *izquierda* es la
touch de `y = 0` y *derecha* la de `y = 70`. Un scrum "de izquierda a derecha" está sobre la touch
izquierda con el campo abierto hacia la derecha.

**Sin rival**: destildando *con rival* el set up que apliques trae sólo tu equipo, y el rival que
hubiera sale de la cancha. Volviendo a tildarlo reaparece según el último aplicado.

**Cada entrenador edita sus set ups base**: los doce son las situaciones, pero la disposición es
de cada uno. Aplicá el set up, acomodá a los jugadores y tocá `＋`: la app pregunta si eso pasa a
ser *tu versión de ese set up* o si preferís crear uno aparte. Guardado encima, ese set up queda
marcado con `✎` en el selector y de ahí en más se aplica el tuyo. El botón de al lado se convierte
en `↺` y lo devuelve a como venía de fábrica; sobre un set up propio ese mismo botón es `🗑`.

El original nunca se pisa: se guarda una capa propia por encima (`rugbyboard.setups.v1`), separada
de los set ups creados desde cero (`rugbyboard.formations.v1`).

**Set ups nuevos**: el botón *Nuevo set up* deja la cancha limpia con la herramienta Jugador lista;
se suman los jugadores que hagan falta y `＋` los guarda con nombre en el grupo *Mis set ups*.

**Pasarlos a otro entrenador**: en el panel izquierdo, *Set ups → Exportar* baja un archivo con tu
versión de los doce más los que hayas creado. El otro entrenador lo carga con *Importar* y le
quedan tus disposiciones sobre las mismas situaciones. Importar suma a lo que ya haya; los set ups
con la misma clave se reemplazan.

**Plantel a mano**: la herramienta Jugador suma los que quieras al equipo elegido en el panel, con
el número corregible desde el panel derecho, que también los quita de a uno. Los set ups definen
su propio plantel; el selector de formato sólo manda en los que traen los quince.

**Espacio de line-out**: el botón del panel *Vista* cambia el escenario por el corredor de
line-out visto de costado, con la línea de touch a la izquierda, las marcas de un metro y las
líneas de 5 m y 15 m. Es un espacio cerrado: la cámara tiene límites (`view.setBounds`), así que
no se puede alejar hasta ver la cancha entera ni salirse del área de trabajo. Los ejes quedan intercambiados (la distancia a la touch corre en
horizontal), así los saltadores se alinean a lo ancho de la pantalla. Los set ups de line
lo abren solos. Todo lo demás funciona igual ahí: recorridos, pases, frames y animación.

La pelota en manos se dibuja pegada al borde de la ficha, con un corrimiento en píxeles y no en
metros de cancha: así queda igual de cerca del jugador en la cancha completa y en el line-out, donde
las fichas se dibujan más chicas. Durante un pase el corrimiento crece con el avance, de modo que
sale del centro del que pasa y termina en la mano del que recibe.

En la cancha las fichas van a escala real, porque la distancia entre jugadores es el dato. En el
escenario de line-out, que trabaja muy ampliado, se dibujan más chicas que el jugador real
(`markScale` en `js/render.js`) para que se lea la separación entre saltadores en vez de un
amontonamiento de círculos.

**Formatos**: XV, 13, ten-a-side y seven. Cambia el plantel manteniendo la numeración real de
cada puesto.

**Video**: el botón *Video* arma un MP4 de 1280x720 a 30 cuadros por segundo, listo para mandar
por WhatsApp, con el nombre de la jugada arriba, la nota del momento abajo y una barra de avance.
Si hay más de una jugada guardada, ofrece encadenarlas todas en un solo archivo con una placa de
título entre cada una.

Codifica con WebCodecs y escribe el contenedor con `js/mp4.js`, un muxer propio que arma un MP4
progresivo: el índice completo antes de los datos y una duración fija por cuadro. Es lo que
reproducen bien WhatsApp y los reproductores de escritorio. `MediaRecorder` queda de respaldo para
navegadores sin WebCodecs, pero devuelve MP4 fragmentado y de cuadro variable, que se traba en
varios reproductores; por eso el archivo se comprueba antes de entregarlo y sólo se cae al
respaldo si la vía principal falla.

**Guardar**: las jugadas quedan en el navegador (localStorage). `Exportar` baja un `.json` que
`Importar` vuelve a leer, para pasarlas entre máquinas o versionarlas. `PNG` baja el frame actual
como imagen.

## Estructura

```
index.html          interfaz
css/app.css         estilos
js/geom.js          geometría: interpolación, longitud de arco, suavizado de trazos
js/model.js         estado de la jugada, frames, set ups, historial, guardado
js/field.js         medidas reglamentarias, cámara y dibujo de los escenarios
js/render.js        jugadores, rutas, pelota y anotaciones
js/mp4.js           muxer de MP4 progresivo
js/video.js         codificación de la animación a video
js/input.js         mouse y touch sobre el canvas
js/ui.js            paneles, timeline e inspector
js/sala.js          la sala en vivo: WebSocket del canal de Supabase, sin librería
js/ensayo.js        modo ensayo: la cancha en la pantalla grande y el teléfono como joystick
js/sync.js          puente entre lo guardado en la máquina y la cuenta
js/home.js          pantalla de inicio: cuenta, club, equipos y arranque
js/cloud.js         cuentas y club contra Supabase, con un modo simulado
js/config.js        claves públicas del proyecto de Supabase
js/app.js           bucle de animación, teclado y arranque
```

Los scripts se cargan como globales bajo el namespace `RG` (no son módulos ES) para que la página
funcione abierta directamente desde el disco, sin servidor.

### Sistema de coordenadas

Todo el modelo está en metros: `x` de -10 a 110 a lo largo del campo (0 y 100 son las líneas de
try, ±10 los in-goals), `y` de 0 a 70 de touch a touch. El equipo propio ataca hacia `x` creciente,
o sea hacia la derecha de la pantalla: la touch izquierda en el sentido del ataque es la de arriba.
Por eso el «scrum de izquierda a derecha» se arma pegado al borde superior, con la línea abriendo
hacia abajo.
La cámara (`js/field.js`) convierte a píxeles; el modelo nunca conoce la pantalla. El escenario
de line-out no rota el contexto del canvas: la cámara intercambia los ejes (`view.swap`), así los
textos siguen derechos y el modelo sigue trabajando en metros de cancha.

### Cómo se mueve la animación

Los frames son posiciones, pero la jugada tiene que verse de una. Dos cosas la hacen continua:

**El tiempo.** Cada tramo se recorre con una curva a la que se le pide la velocidad de entrada y la
de salida. En el borde entre dos tramos se usa la menor de las dos velocidades medias, así los dos
lados coinciden: el que sigue corriendo cruza el frame sin frenar, y el que arranca o para lo hace
de verdad.

**El recorrido.** El tramo sin trazo dibujado no es una recta entre dos puntos sino una curva que
entra y sale en la dirección de sus vecinos: si el frame de al lado tiene un trazo a mano, se toma
la punta del trazo; si no, la posición del frame de más allá; y en las puntas de la jugada, el
reflejo del propio tramo, para que no se deforme al arrancar ni al terminar. El que se queda quieto
se queda quieto: sin esa excepción la curva, tirada por los vecinos, lo hacía salir y volver.

Medido muestreando a 60 por segundo: en una corrida de tres tramos la velocidad no cae a cero en
los bordes y el giro entre cuadros es de 0°; en un quiebre de 90 grados el giro máximo es de 4,6°
por cuadro en lugar de los 90 de golpe; el primero y el último frame quedan exactos donde el
entrenador los dejó. Muestrear la jugada entera con treinta jugadores cuesta 0,08 ms por cuadro.

### Formato de la jugada

```jsonc
{
  "v": 1,
  "name": "Line-out: salto de 5",
  "squad": 15,
  "colors": { "a": "#e8503a", "b": "#3f7fe0" },
  "players": [{ "id": "a9", "team": "a", "num": 9, "label": "Medio scrum" }],
  "frames": [{
    "dur": 1.2,                                    // segundos de transición hacia este frame
    "note": "Pase al 10",
    "pos": { "a9": { "x": 38.5, "y": 11.5 } },     // posición al final del frame
    "routes": { "a10": { "pts": [], "kind": "run" } }, // recorrido desde el frame anterior
    "ball": { "carrier": "a10", "x": 0, "y": 0 },  // carrier null = pelota suelta en x,y
    "ballRoute": null,                             // trayectoria de patada
    "ann": []                                      // flechas, conos, textos
  }]
}
```

## Cuentas de entrenador

Cada entrenador entra con su mail, sin contraseña, y sus set ups y jugadas quedan en su cuenta.
Los pasos para montar el servidor están en [docs/backend.md](docs/backend.md).

### Las cuatro capas

Un set up se arma sobre el anterior, y el de arriba tapa al de abajo sin borrarlo:

| Capa | Quién la deja | Quién la ve |
|---|---|---|
| fábrica | viene con la app | todos |
| global | el administrador del producto | todos los clubes |
| club | el dueño o un admin del club | los entrenadores de ese club |
| personal | cada entrenador | sólo él |

Al guardar, la app pregunta en qué capa, y sólo ofrece las que esa cuenta puede escribir: un
entrenador raso ni ve la pregunta. Sacar la versión de arriba deja a la vista la de abajo: nunca
se pierde la base. En el selector, `✎` marca la versión propia, `★` la del club y `◆` la global.

El dueño del club asciende a un entrenador a **admin del club** desde la pantalla de inicio; el
administrador del producto se marca a mano en la base, a propósito.

### Llevarlo de una dirección a otra

Lo guardado en el navegador es de cada dirección web: lo armado en el visor de artifacts no
aparece en `github.io`, porque para el navegador son dos lugares distintos. **Exportar** baja todo
lo propio, set ups y jugadas, en un archivo; **Importar** lo trae, desde el archivo o pegando el
texto, que es lo que sirve cuando el visor bloquea la descarga.

### Cómo se guarda

El modelo trabaja siempre contra una copia local (`js/model.js`), y `js/sync.js` la sube y la baja.
La app abre sin esperar la red, se puede seguir trabajando sin conexión y lo pendiente sube solo
cuando vuelve. Lo que se venía guardando sin cuenta se muda a la cuenta la primera vez que entra,
sin duplicarse si después entra otro entrenador en la misma máquina.

Las reglas de acceso están probadas contra Postgres y el armado de capas contra el modelo: un
entrenador ve lo global, la base de su club y lo suyo; no puede publicar donde no le corresponde;
y su versión no toca la del club.

### Entrar

Dos caminos a la misma cuenta: mail y contraseña, y link por mail. La contraseña es el de todos los
días porque no depende del correo; el link queda para la primera vez, para el que no la recuerda y
para el que abrió la cuenta así. El que entró con el link puede dejar una contraseña puesta desde
la pantalla de inicio.

### La sesión

Se entra una vez con el link del mail y la sesión queda guardada en el dispositivo. Se renueva sola
cinco minutos antes de vencer y también al volver a la pestaña; si un pedido se cruza con el
vencimiento, se renueva y se repite una sola vez, sin que salte la pantalla de entrar. Dos pedidos
que necesitan renovar a la vez comparten la misma renovación, porque el servidor rota la llave y si
se piden dos juntas se pisan.

Lo importante es cuándo **no** se borra: quedarse sin señal o que el servidor no conteste no echa a
nadie, la sesión queda y se reintenta. Sólo se borra cuando el servidor responde que la llave ya no
vale.

Probado con un servidor de mentira: llave vencida sin red (sigue adentro), llave vencida con
servidor (renueva una vez), servidor que rechaza la llave (pide entrar de nuevo y limpia), 401 en
medio de un pedido (renueva y reintenta una vez) y tres pedidos simultáneos (una sola renovación).

### Que no se quede una versión vieja

Los archivos se sirven con la versión pegada en la dirección, y `version.json` dice cuál es la
última. Al abrir, la app compara la suya con esa y, si quedó atrás, se recarga una sola vez
pidiéndola con la versión nueva en la dirección. Hace falta porque el servidor cachea y en el
teléfono no hay Ctrl+F5. La versión está a la vista arriba a la izquierda en la pizarra, y al lado
del código en la sala.

## Administración

El administrador del producto (`profiles.is_admin`) tiene su pantalla: todos los clubes con sus
equipos y su cuerpo técnico, crear y renombrar clubes, sumar y sacar equipos, ascender a un
entrenador a dueño o a admin del club, sacar gente y borrar un club entero. Para borrar hay que
escribir el nombre del club: se lleva puesto todo lo que haya adentro.

Lo que de verdad deja o no deja son las reglas de acceso de la base
([`db/migration-4.sql`](db/migration-4.sql)), no que el botón esté escondido: cada permiso nuevo es
«o es el administrador», y para el entrenador común no cambia nada.

## Modo ensayo

El entrenador abre una jugada desde la pantalla de inicio, la app arma una sala con un código de
cuatro caracteres y el plantel entra desde el teléfono a la misma dirección: «Entrar a una sala»,
el código, y cada uno elige su número. La pantalla grande muestra la cancha entera; el teléfono
sigue a la ficha propia de cerca y trae un joystick abajo.

La pantalla del entrenador es la que manda: recibe el empuje de cada teléfono, integra las
posiciones y reparte el estado ocho veces por segundo. Los teléfonos no calculan nada, así que si
se pierde un mensaje nadie queda con una cancha distinta. El empuje se manda a ritmo fijo mientras
el dedo está apoyado, no cuando se mueve: el dedo se queda quieto en el borde y el jugador sigue
corriendo. Si un teléfono deja de mandar por más de un segundo, su ficha frena sola.

Con servidor conectado va por el canal en tiempo real de Supabase, que es un WebSocket con el
protocolo de Phoenix, hablado a mano igual que el resto de la app. Sin servidor queda el canal del
propio navegador, que sólo une pestañas de la misma máquina: sirve para probarlo, no para el
plantel.

Probado con dos teléfonos y un entrenador en el mismo navegador: entrar antes de que la sala
exista y que el saludo insista solo, tomar número, que el segundo no pueda tomar el mismo, correr
con el joystick y que la posición sea la misma en las tres pantallas.

Falta la parte de comparar: grabar el recorrido de cada uno durante el ensayo y medirlo contra la
ruta de la jugada.

## Para seguir

Lo próximo es cerrar el modo ensayo: grabar lo que hizo cada jugador y compararlo con la ruta de la
jugada, con un número por jugador y el dibujo de los dos recorridos encima.

Otras ideas anotadas: medir distancias y tiempos sobre la cancha, vista vertical, y jugadores con
velocidad propia para simular llegadas en vez de interpolar por tiempo fijo.
