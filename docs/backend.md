# Cuentas de entrenador: cómo montar el backend

La app hoy guarda todo en el navegador. Para que cada entrenador tenga su cuenta hace falta un
servidor. Estas instrucciones montan uno con Supabase, que trae base de datos, login y permisos en
el mismo lugar y no requiere mantener infraestructura. El plan gratis alcanza de sobra para varios
clubes.

Son unos quince minutos. Al terminar, pasame los dos valores del paso 5 y conecto la app.

## 1. Crear el proyecto

En [supabase.com](https://supabase.com) entrá con tu cuenta de GitHub o tu mail y creá un proyecto
nuevo. Elegí la región **South America (São Paulo)**, que es la más cercana. Anotá la contraseña de
la base que te pide: no la usa la app, pero la vas a necesitar si algún día entrás por fuera.

## 2. Instalar el esquema

En el panel del proyecto, **SQL Editor** → **New query**. Pegá el contenido completo de
[`db/schema.sql`](../db/schema.sql) y apretá **Run**. Tiene que decir *Success*.

Eso crea las tablas (clubes, equipos, entrenadores, set ups, jugadas) y las reglas de acceso:

- Cada entrenador ve y edita **sus** set ups y jugadas, siempre.
- Ve los de otros **sólo** si están compartidos a un equipo del que también forma parte.
- Nadie puede modificar ni borrar lo de otro, aunque lo vea.
- Dos entrenadores pueden tener cada uno su versión del mismo set up base sin pisarse.

Está probado contra Postgres, no sólo escrito: se simularon dos entrenadores del mismo club y se
verificó cada uno de esos cuatro puntos.

## 2b. Correr la corrección

Al escribir la pantalla de cuerpo técnico aparecieron dos faltantes del esquema inicial: el perfil
no guardaba el mail (está en `auth.users`, que el navegador no puede leer) y cada entrenador sólo
veía su propio perfil, así que la lista del club salía sin nombres.

Repetí el paso anterior con [`db/migration-1.sql`](../db/migration-1.sql): **SQL Editor** → **New
query** → pegar → **Run**. Se puede correr más de una vez sin romper nada.

## 2c. Correr la segunda corrección: los tres niveles

Los set ups y las jugadas pasan a tener nivel:

| Nivel | Quién lo publica | Quién lo ve |
|---|---|---|
| **global** | el administrador del producto | cualquier entrenador, de cualquier club |
| **club** | el dueño o un admin del club | los entrenadores de ese club |
| **personal** | cada entrenador | sólo él |

Los tres conviven sobre la misma situación: el entrenador abre la del club, y si no hay, la
global; guarda su versión y esa pasa a ser la suya, sin tocar las de abajo.

Pegá y corré [`db/migration-2.sql`](../db/migration-2.sql) igual que las anteriores.

**Después, date de alta como administrador del producto.** En el SQL Editor, con tu mail:

```sql
update profiles set is_admin = true where email = 'tu@mail.com';
```

Eso es lo único que se hace a mano: no hay pantalla para volverse admin, a propósito. Para los
admins de club sí la hay: el dueño asciende a un entrenador desde la app.

Probado en Postgres simulando cuatro cuentas: el admin publicando global, el dueño de un club
publicando la base del club, una entrenadora guardando su versión encima de las dos, y un
entrenador de otro club viendo sólo lo global. También que la entrenadora no pueda publicar al
club hasta que la asciendan, ni tocar lo global nunca.

## 2d. Correr la tercera corrección: guardar sin duplicar

La app guarda el mismo set up muchas veces, cada vez que se corrige una posición. Estas dos
funciones deciden si es alta o corrección, en el nivel que corresponda, y avisan con un error
cuando el nivel está fuera del alcance de quien guarda.

Pegá y corré [`db/migration-3.sql`](../db/migration-3.sql).

## 2e. Correr la cuarta corrección: la pantalla de administración

Para poder administrar todos los clubes desde la app hace falta que las reglas de acceso dejen
pasar al administrador del producto: sin esto, ni siquiera puede listarlos, porque cada uno ve sólo
el club del que es parte. Pegá y corré [`db/migration-4.sql`](../db/migration-4.sql).

Después de eso, entrando con tu cuenta aparece **Administrar clubes y equipos** en la pantalla de
inicio: crear clubes, renombrarlos, sumar y sacar equipos, ver el cuerpo técnico de cada uno,
ascender a un entrenador a dueño o a admin del club, sacar gente, y borrar un club entero.

Probado contra Postgres con cuatro cuentas: un entrenador sigue viendo un solo club y no puede
tocar el ajeno, el administrador ve los dos, los renombra, les agrega equipos, pasa el club a otro
dueño y lo borra con todo lo suyo.

## 3. Configurar la entrada por link de mail

**Authentication** → **Providers** → **Email**. Dejá *Enable Email provider* activado y
**desactivá** *Confirm password* / *Enable password sign-up*: sin contraseñas, sólo el link.

En **Authentication** → **URL Configuration**, poné en *Site URL* la dirección donde va a vivir la
app (mientras probamos, `http://localhost:8123`; después la definitiva) y agregá esa misma
dirección en *Redirect URLs*.

Con el plan gratis, Supabase manda los mails desde su propio servidor con un límite de unos pocos
por hora, suficiente para probar. Cuando lo abras al club conviene conectar un servicio de mail
propio (Resend tiene plan gratis) para que no se demoren.

## 3b. Que la sesión no se caiga

Con el link del mail se entra una vez y la sesión queda guardada en ese dispositivo: se renueva
sola antes de vencer, aguanta quedarse sin señal y sólo pide volver a entrar si el servidor dice
que la llave ya no vale.

Dos cosas la cortan y no dependen de la app:

- **Abrir el link del mail en otro navegador.** Si el mail se abre desde la aplicación de Gmail, el
  link puede abrirse en el navegador interno de esa app: la sesión queda ahí y no en el navegador
  donde se usa la pizarra. Conviene abrir el link en el mismo navegador.
- **Borrar los datos del sitio**, que también borra la sesión. Ya no hace falta hacerlo para forzar
  una versión nueva: la app se actualiza sola.

Si aun así se cae seguido, mirá en **Authentication** → **Sessions** que no haya un límite de
tiempo o de inactividad puesto: de fábrica vienen sin límite.

## 4. Crear tu club

No hace falta tocar la base: la primera vez que entres a la app te va a ofrecer crear el club y te
va a dar un **código de seis caracteres**. Ese código se lo pasás a Yanina y a Nico, ellos entran
con su mail y quedan dentro del club.

Los equipos (Primera, M19, lo que uses) se crean desde la app. El que crea el club queda como
dueño; el resto entra como entrenador.

## 5. Pasarme las credenciales

**Project Settings** → **API**. Copiame:

- **Project URL** (algo como `https://abcdefgh.supabase.co`)
- **anon public** key (la clave larga que dice `anon`)

Esas dos van en el código de la app, a la vista de cualquiera, y está bien: son públicas por
diseño. Lo que protege los datos son las reglas del paso 2, que se aplican en el servidor. La clave
que **no** hay que compartir nunca es la `service_role`, que saltea todas las reglas.

## 5b. El modo ensayo

La sala en vivo usa el canal de tiempo real de Supabase, que viene activado por defecto: no hay
nada que correr ni configurar. Si al abrir una sala la pantalla dice *el servidor rechazó la sala*,
mirá en **Settings** → **Realtime** que esté habilitado en el proyecto.

Los mensajes son ligeros (posiciones redondeadas) pero constantes: con quince jugadores moviéndose,
una sesión de veinte minutos gasta alrededor de cien mil mensajes, y el plan gratis trae dos
millones por mes. Alcanza para unas veinte sesiones mensuales; si se queda corto, el plan pago
sube el tope.

## 6. Dónde va a vivir la app

Supabase guarda los datos, pero la app en sí necesita una dirección web. Dos opciones, las dos
gratis:

- **GitHub Pages**: Settings → Pages → rama `main`, carpeta raíz. Queda en
  `trsaraceni-oss.github.io/juego-rugby`. Requiere que el repositorio esté publicado, y para eso
  falta el acceso de escritura.
- **Vercel** o **Netlify**: se conectan al repositorio y publican solos en cada cambio. Permiten
  usar un dominio propio si algún día querés uno.

Cualquiera sirve. GitHub Pages es un paso menos.

## Qué pasa con lo que ya tenés guardado

Nada se pierde. La primera vez que entrás con tu cuenta, los set ups y las jugadas que tengas en
ese navegador se suben solos y quedan como tuyos. Si después entra otro entrenador en la misma
máquina, no se le copian.

Ojo con una cosa: lo guardado es de cada dirección web. Lo que armaste abriendo la app desde el
visor de Claude no aparece en `github.io`, porque para el navegador son dos lugares distintos. Para
llevarlo de uno a otro, en la pizarra: **Exportar set ups** de un lado, **Importar** del otro.
