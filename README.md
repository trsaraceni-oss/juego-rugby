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

**Formaciones y ejemplos**: el selector de arriba trae tres jugadas armadas (line-out, scrum al
lado ciego, contraataque desde patada), seis formaciones completas (ataque en fase, scrum,
line-out, salida, defensa en 22, equipos alineados) y cuatro parciales para trabajar una unidad
sola: line-out, scrum, línea de tres cuartos y cancha vacía. Cargar una reemplaza la jugada actual.

**Sin rival**: destildando *Con equipo rival* la formación que apliques trae sólo tu equipo, y el
rival que hubiera sale de la cancha. Volviendo a tildarlo reaparece según la última formación.

**Plantel a mano**: partiendo de *Cancha vacía*, la herramienta Jugador suma los que quieras, con
el número corregible desde el panel derecho, que también los quita de a uno. Las formaciones
parciales definen su propio plantel; el selector de formato sólo manda en las completas.

**Espacio de line-out**: el botón del panel *Vista* cambia el escenario por el corredor de
line-out visto de costado, con la línea de touch a la izquierda, las marcas de un metro y las
líneas de 5 m y 15 m. Es un espacio cerrado: la cámara tiene límites (`view.setBounds`), así que
no se puede alejar hasta ver la cancha entera ni salirse del área de trabajo. Los ejes quedan intercambiados (la distancia a la touch corre en
horizontal), así los saltadores se alinean a lo ancho de la pantalla. La formación *Line-out solo*
lo abre sola. Todo lo demás funciona igual ahí: recorridos, pases, frames y animación.

En la cancha las fichas van a escala real, porque la distancia entre jugadores es el dato. En el
escenario de line-out, que trabaja muy ampliado, se dibujan más chicas que el jugador real
(`markScale` en `js/render.js`) para que se lea la separación entre saltadores en vez de un
amontonamiento de círculos.

**Formatos**: XV, 13, ten-a-side y seven. Cambia el plantel manteniendo la numeración real de
cada puesto.

**Guardar**: las jugadas quedan en el navegador (localStorage). `Exportar` baja un `.json` que
`Importar` vuelve a leer, para pasarlas entre máquinas o versionarlas. `PNG` baja el frame actual
como imagen.

## Estructura

```
index.html          interfaz
css/app.css         estilos
js/geom.js          geometría: interpolación, longitud de arco, suavizado de trazos
js/model.js         estado de la jugada, frames, formaciones, historial, guardado
js/demos.js         jugadas de ejemplo
js/field.js         medidas reglamentarias, cámara y dibujo de los escenarios
js/render.js        jugadores, rutas, pelota y anotaciones
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
