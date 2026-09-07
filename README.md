# Rugby Board

Simulador de jugadas de rugby en el navegador. Cancha reglamentaria, jugadores que se arrastran,
recorridos dibujados a mano y animación por frames. Sin dependencias, sin build: es HTML, CSS y
JavaScript plano.

## Cómo abrirlo

Doble click en `index.html`. Nada más.

Para publicarlo online: Settings → Pages → Deploy from a branch → rama `main`, carpeta `/ (root)`.

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
js/app.js           bucle de animación, teclado y arranque
```

Los scripts se cargan como globales bajo el namespace `RG` (no son módulos ES) para que la página
funcione abierta directamente desde el disco, sin servidor.

### Sistema de coordenadas

Todo el modelo está en metros: `x` de -10 a 110 a lo largo del campo (0 y 100 son las líneas de
try, ±10 los in-goals), `y` de 0 a 70 de touch a touch. El equipo propio ataca hacia `x` creciente.
La cámara (`js/field.js`) convierte a píxeles; el modelo nunca conoce la pantalla. El escenario
de line-out no rota el contexto del canvas: la cámara intercambia los ejes (`view.swap`), así los
textos siguen derechos y el modelo sigue trabajando en metros de cancha.

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

## Para seguir

Ideas que quedaron afuera y son fáciles de sumar sobre esta base: exportar la animación a video o
GIF, biblioteca de jugadas compartida, medir distancias y tiempos sobre la cancha, vista vertical,
y jugadores con velocidad propia para simular llegadas en vez de interpolar por tiempo fijo.
