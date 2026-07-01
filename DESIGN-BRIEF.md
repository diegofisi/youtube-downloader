# Design Brief — YouTube Downloader (rediseño desde cero)

> **Diseña desde una hoja en blanco.** No hay paleta, tipografía, layout ni estilo
> prescrito: tú defines la identidad visual completa. Este documento describe **qué debe
> ser y hacer el producto**, no cómo debe verse.
>
> **Mentalidad:** NO replicar la versión actual (que es un producto básico de 2 pasos).
> Queremos una **app completa, pulida y potente** de descarga de YouTube, a la altura de
> las mejores herramientas del mercado. Piensa "producto premium", no "utilidad mínima".
>
> Idioma de la UI: **español**.

---

## 1. Visión de producto

Una app de escritorio para descargar contenido de YouTube de forma **inteligente y
completa**: el usuario inicia sesión con su cuenta de YouTube, pega o explora contenido,
**ve un preview de lo que va a descargar** (miniatura, título, canal, duración, si es de
miembros, etc.), elige **calidad / formato / solo-audio / subtítulos** y gestiona todo
desde una **cola y biblioteca** ricas. Debe sentirse como una herramienta moderna,
fluida y de confianza — no un formulario.

**Diferenciadores que queremos lograr (lo que hoy NO existe):**
- **Preview antes de descargar**: al pegar un listado/URL, mostrar tarjetas con miniatura,
  título, canal, duración, vistas, disponibilidad y si requiere sesión/membresía. Saber
  qué SÍ y qué NO se podrá descargar **antes** de empezar.
- **Integración real con la cuenta de YouTube**: tras loguearse, mostrar avatar/canal del
  usuario y permitir **explorar y descargar desde su propio YouTube** (suscripciones,
  playlists, "Ver más tarde", "Me gusta", canales de membresía a los que pertenece).
- **Opciones completas de descarga**: calidad de video (4K/1080p/720p/…/auto), **solo
  audio** (MP3/M4A/Opus con bitrate), formato/contenedor, **subtítulos**, miniatura,
  capítulos, rango de playlist, recorte por tiempo, SponsorBlock, etc.
- **Gestión avanzada**: cola con pausa/reanudar/reordenar, historial/biblioteca de
  descargas, búsqueda, notificaciones, reintentos inteligentes.

---

## 2. Usuario y principios

- **Usuario**: alguien que descarga bastante YouTube (incluido contenido de membresía con
  su cuenta) y quiere control y comodidad.
- **Principios de diseño** (tú eliges la estética, pero respeta esto):
  - **Claridad antes que densidad**: hoy todo está apretado; queremos jerarquía y aire.
  - **Feedback en todo momento**: estados de carga, progreso, error y vacío bien resueltos.
  - **Confianza**: mostrar siempre qué va a pasar (preview, disponibilidad, tamaño estimado).
  - **Eficiencia para listas grandes**: pensar el caso de 1 video y el de 200 videos.
  - **Marca propia**: define un sistema visual coherente (color, tipografía, iconografía,
    motion). Puedes inspirarte en lo "YouTube" sin copiarlo; evita verse genérico.

---

## 3. Reconsiderar el contenedor (importante)

La versión actual es una **ventana fija de 780×700 no redimensionable**. Para un producto
completo (preview, sidebar de cuenta, biblioteca, cola rica) **recomendamos un layout más
grande y redimensionable**, posiblemente con **navegación lateral o por secciones**
(p.ej.: Descargar / Mi YouTube / Cola / Biblioteca / Ajustes). Diséñalo para una ventana de
escritorio amplia y responsiva (cambiar a ventana redimensionable es un ajuste trivial de
config en el backend). Propón el layout que mejor sirva al producto, sin atarte a 780×700.

---

## 4. Mapa de funcionalidades a diseñar

Diseña pantallas/estados para todo esto. Marcado: **[hoy]** ya existe en backend ·
**[nuevo]** requiere trabajo de backend (proponlo igual; es parte de la visión) ·
**[fácil-nuevo]** el dato ya está disponible o es barato de añadir.

### A. Entrada inteligente + Preview
- Pegar **una o varias URLs** (una por línea) o un enlace de **playlist/canal** **[hoy: pegar URLs]**.
- Al pegar, **resolver metadatos** y mostrar **tarjetas de preview** por video **[nuevo]**:
  miniatura, título, canal (+avatar), duración, vistas/fecha, **disponibilidad**
  (descargable / privado / de miembros / bloqueado por región / requiere login), y
  **tamaño estimado** según la calidad elegida.
- **Expandir playlists/canales** a su lista de videos, con **selección** (marcar/desmarcar,
  seleccionar todo, rango) **[nuevo]**.
- Señalar **duplicados** y **ya descargados** **[nuevo]**.
- Acción por tarjeta y acción global ("Descargar seleccionados").

### B. Opciones de descarga (por video y/o globales)
- **Calidad de video**: Auto / Máxima / 4K / 1440p / 1080p / 720p / 480p / 360p **[nuevo]**.
- **Solo audio**: MP3 / M4A / Opus, con **bitrate** **[nuevo]**.
- **Contenedor**: MP4 / MKV / WebM **[nuevo]** (hoy fijo MP4).
- **Subtítulos**: descargar/incrustar, idioma, incluir auto-generados **[nuevo]**.
- **Extras**: incrustar miniatura, capítulos, metadatos; **SponsorBlock** (saltar
  patrocinios); **recorte por tiempo** (clip desde–hasta); **rango de playlist** **[nuevo]**.
- **Plantilla de nombre de archivo** y carpeta destino **[hoy: carpeta]**.
- UX sugerida: un **panel de opciones** con presets rápidos (ej. "1080p MP4", "Solo audio
  MP3", "Máxima calidad") + modo avanzado para ajustar todo.

### C. Mi YouTube (integración de cuenta)
- **Login** con la cuenta de YouTube **[hoy: login WebView que extrae cookies]**.
- Tras loguear, mostrar **avatar + nombre de canal/handle** del usuario **[nuevo]** y un
  estado de sesión claro (conectado / expirada / cerrar sesión).
- **Explorar y descargar desde el propio YouTube** **[nuevo]**: suscripciones, playlists,
  "Ver más tarde", "Me gusta", historial, y **canales de membresía** a los que pertenece —
  como fuentes navegables desde las que seleccionar y descargar.
- Manejar el caso de **sesión colgada/cerrada** sin que la UI quede bloqueada (problema real
  hoy: el botón se queda en "cargando" para siempre si cierras el login).

### D. Cola de descargas (rica)
- Items con **miniatura**, título, canal, **progreso (%, velocidad, ETA, tamaño)**
  **[fácil-nuevo: velocidad/ETA ya llegan]**, estado y acción contextual.
- Acciones por item: **pausar / reanudar** **[nuevo]**, cancelar **[hoy]**, reintentar
  **[hoy]**, quitar **[hoy]**, **reordenar / prioridad** **[nuevo]**, abrir archivo/carpeta.
- **Concurrencia** configurable (cuántas descargas simultáneas) **[hoy: 5/10/20/50/Todos]**.
- Resumen global (completados / en curso / errores) y barra global **[hoy]**.
- Estados claros y **diferenciados**: en cola, descargando, **procesando/merge**, completado,
  error (con mensaje accionable), **cancelado ≠ error** (hoy se confunden).
- **Reintento inteligente** (p.ej. "recargar cookies y reintentar fallidos").

### E. Biblioteca / Historial
- Vista de **descargas completadas** **[nuevo]**: miniatura, título, formato/calidad,
  tamaño, fecha, ubicación; **buscar/filtrar**, abrir, reproducir, re-descargar, borrar.
- Acceso rápido a la **carpeta de descargas** **[hoy: abrir carpeta]**.

### F. Ajustes
- Calidad/formato por defecto, carpeta destino y **plantilla de nombre**, concurrencia,
  subtítulos por defecto, SponsorBlock, **tema/apariencia**, notificaciones, idioma,
  gestión de sesión, y estado/actualización de componentes (yt-dlp/ffmpeg) **[mix hoy/nuevo]**.

### G. Primer arranque / Setup
- La app instala automáticamente sus motores (yt-dlp, ffmpeg, deno) la primera vez
  **[hoy]**. Diseña un **onboarding** agradable: bienvenida, progreso de preparación por
  componente, manejo de error con reintento, y transición a la app. Hazlo sentir cuidado,
  no un loader técnico.

---

## 5. Datos disponibles para mostrar (qué puede pintar la UI)

- **Por video** (vía resolución de metadatos, **[nuevo]** pero estándar en yt-dlp):
  miniatura(s), título, canal + avatar, duración, vistas, fecha, descripción, formatos/
  calidades disponibles con tamaño estimado, flags (privado, de miembros, edad, región),
  subtítulos disponibles, capítulos.
- **Progreso de descarga en vivo** **[hoy]**: porcentaje, **velocidad**, **ETA**, y un estado
  "procesando" durante el merge. (Nota: hoy NO hay un evento explícito de "100%"; el fin se
  infiere al terminar el proceso — diseña el "completado" pensando en eso.)
- **Cuenta** **[nuevo]**: avatar, nombre/handle, listas (suscripciones, playlists, etc.).
- **Sesión/cookies** **[hoy]**: estado conectado / sin sesión / archivo inválido.

---

## 6. Realidad técnica (para que el diseño sea construible)

- **Stack**: app de escritorio **Tauri** (backend Rust ejecuta **yt-dlp + ffmpeg + deno**;
  frontend web). Si entregas código, que sea **HTML/CSS/TS sin framework de UI pesado**
  (o algo fácilmente integrable a Vite). Usa **variables CSS / design tokens**.
- **Lo que el backend ya hace [hoy]**: descargar (hoy MP4 best), login WebView que extrae
  cookies (incl. HttpOnly), setup de dependencias, carpeta de descargas, progreso en vivo,
  multi-descarga concurrente, cancelar/reintentar.
- **Lo que hay que construir [nuevo]** (parte de esta visión, factible con yt-dlp):
  resolución de metadatos/preview (`--dump-json`/`--flat-playlist`), selección de calidad
  (`-f`), solo-audio (`-x`), subtítulos (`--write-subs`), contenedor, SponsorBlock, recorte,
  rango de playlist, pausa/reanudar, biblioteca/historial persistente. La **info de cuenta**
  (avatar, listas, membresías) se puede obtener vía la sesión autenticada / API de YouTube.
- No te frenes por esto: **diseña el producto completo**. Solo marca tú lo que sea claramente
  "v2/futuro" si lo ves muy lejano, pero asume que casi todo es alcanzable.

---

## 7. Qué entregar

1. **Concepto e identidad visual desde cero**: sistema de diseño propio (color, tipografía,
   espaciado, iconografía, estilo de componentes, motion). Tema oscuro y/o claro a tu criterio.
2. **Arquitectura de navegación / layout** para la app completa (propón secciones, p.ej.
   Descargar · Mi YouTube · Cola · Biblioteca · Ajustes).
3. **Mockups de las pantallas y estados clave**:
   - Onboarding/setup.
   - Login + estado "Mi YouTube" (avatar, listas, membresías).
   - Entrada + **preview de la lista** (con selección, disponibilidad, tamaño estimado).
   - **Panel de opciones de descarga** (presets + avanzado: calidad, audio, subtítulos…).
   - **Cola** rica (item con miniatura/progreso/acciones) + estados (descargando, procesando,
     completado, error, cancelado, pausado, vacío).
   - **Biblioteca/Historial** y **Ajustes**.
4. **Componentes y estados** documentados (botones, tarjetas de video, badges de estado,
   barras de progreso, menús de opciones, modales, toasts/notificaciones).
5. Si es posible, **HTML + CSS** de referencia con tokens, integrable al stack Tauri/Vite.

**Tono y copy**: español, claro y cercano. Tú propones los textos (no estás obligado a
reutilizar los actuales); prioriza mensajes accionables, sobre todo en errores y estados vacíos.

---

### Resumen en una frase
Convierte un descargador básico de 2 pasos en una **app completa de YouTube**: con sesión real
de la cuenta del usuario, **preview de lo que va a descargar**, **opciones plenas de calidad/
audio/subtítulos**, y una **cola + biblioteca** modernas — con una identidad visual diseñada
desde cero.
