# Patrones de UI (TS vanilla, sin framework)

## El patrón base: innerHTML + rebind con `data-*`

Toda lista/grid se repinta entera y se recablea después. Nunca hay estado en el DOM:

```ts
function renderList(): void {
  closeAnchoredMenu();                       // el ancla de un menú abierto deja de existir al repintar
  $('{pfx}-list').innerHTML = items.map((it) => `
    <button data-url="${esc(it.url)}" style="…">${esc(it.title)}</button>`).join('');
  $('{pfx}-list').querySelectorAll<HTMLElement>('[data-url]').forEach((b) =>
    b.addEventListener('click', () => onPick(b.dataset.url!)),
  );
}
```

- El wiring de botones ESTÁTICOS (existen en index.html) se hace UNA vez en `init{Name}()`.
- En un `paint()` que se re-ejecuta (modales), usar `.onclick`/`.oninput` en vez de
  `addEventListener` "para no acumular listeners entre repintados" (video-opts-modal.ts).
- **`esc()` es obligatorio** para todo dato dinámico interpolado (títulos, URLs, mensajes de error:
  `Error: ${esc(String(e))}`). Solo se omite en literales propios e iconos del registro `I`.

## Componentes shared reales (firmas y cuándo usarlos)

| Componente | Firma | Cuándo |
|---|---|---|
| `dom.$` | `$<T extends HTMLElement>(id): T` — lanza si no existe | Siempre, en vez de getElementById (falla ruidoso y tipado) |
| `toast.showToast` | `(title, body = '', kind: 'done'\|'warn'\|'info'\|'error' = 'done', ms = 4200)` | Feedback no bloqueante. Título corto + detalle en body |
| `modal.showModal` | `(title, message, showCancel = false): Promise<boolean>` | Confirmaciones destructivas (vaciar historial, borrar archivo) |
| `media-card.videoCard` | `(v: CardMedia, selected: boolean): string` | Tarjeta de grid (Buscar / Mi YouTube). Tipo estructural mínimo: VideoMeta lo cumple |
| `media-card.wireVideoCards` | `(list, items, { toggle(url), download(anchor, item) })` | Recablear checkbox y botón ⬇ tras pintar el grid |
| `media-card.stateCard / loadingCard` | `(title, msg, actionHtml = '')` / `(labelHtml)` | Estados vacío/error y fila de carga del grid |
| `media-card.renderPillBar` | `(el, items {key,label}[], active, onPick)` | Tabs/chips de filtro (no se re-renderiza sola: onPick repinta) |
| `paged-loader.createPagedLoader` | `({ pageSize, key, fetchPage(start,end), moreButtonId, onPage })` | Cualquier lista con "Ver más" paginada contra `analyzeUrls(range)` |
| `anchored-menu.openAnchoredMenu` | `(anchor, items {icon?,label,color?,onPick}[])` | Menú contextual anclado a un botón (toggle, click-fuera, Escape, clamp al viewport) |
| `controls.renderChipGroup` | `(groupSel, [valor,label][], get, onPick, {pad?, rerender?, after?})` — pinta en `[data-group="…"]` | Grupos de chips (calidad, contenedor…) |
| `controls.renderSeg / renderToggle` | `(id, list, get, set)` / `(id, get, set)` | Segmentados estilo Ajustes / interruptores on-off |
| `gradients.gradFor / CARD_GRAD` | `(id): string` degradado estable por hash / degradado fijo | Fondo de miniaturas sin imagen |
| `format.fmtDuration / fmtSize / timeAgo / fmtDate` | ver shared/lib/format.ts | Duración `h:mm:ss`, MB/GB, "hace X", fecha local por idioma |
| `dl-actions.*` | `flatten, defaultOptions, toQueueItem, openDlMenu, downloadSelected, customizeSelected` | SOLO para grids tipo Buscar/Mi YouTube (flujo descargar/personalizar) |

## Paginación anti-race: `begin()` + `loadSeq`

El paged-loader encapsula `nextStart/hasMore/loadingMore/loadSeq`. La primera página la orquesta
cada vista (su propio loading/vacío/error); las siguientes las gestiona el botón "Ver más":

```ts
const loader = createPagedLoader<VideoMeta>({
  pageSize: 50,
  key: (v) => v.id || v.url,                       // dedupe si el feed se mueve entre páginas
  fetchPage: async (start, end) => ({ items: flatten(await analyzeUrls([srcUrl()], { start, end })) }),
  moreButtonId: '{pfx}-more',
  onPage: () => renderList(),
});
loader.wireMore();                                  // una vez, en init

async function load(): Promise<void> {
  const seq = loader.begin();                       // invalida cargas anteriores
  pintarLoading();
  try {
    if ((await loader.loadFirst(seq)) === 'stale') return;   // llegó tarde: descartar
    renderList();
  } catch (e) { pintarError(e); }                   // los errores stale NO llegan aquí
}
```
Si la vista filtra en cliente, pasar `rawCount` en el resultado para que `hasMore` se calcule
sobre lo crudo (search-view.ts).

## Single-flight

Para operaciones que varios llamadores pueden disparar a la vez, compartir la promesa/flag:
- `session.state::attemptSilentReconnect` — guarda `silentReconnectInFlight: Promise<boolean> | null`.
- `queue.state::handleAuthFailure` — flag booleano `authReconnectInFlight`.
- `account-card::ensureAccountInfo` — cachea la promesa y descarta el resultado si fue invalidada
  (`if (p !== accountInfoPromise) return;`).

## Drafts de modal (aplicar solo al confirmar)

`video-opts-modal.ts`: los cambios editan `ovDraft` (copia del override); "Listo" hace commit a
`overrides[url]`; X / Escape / backdrop descartan. Un draft vacío BORRA el override
(`delete overrides[url]`). Los inputs de texto no se repintan mientras tienen foco
(`if (document.activeElement !== tplIn) tplIn.value = …`).

## Visibilidad: `hidden` vs `.is-active`

- **Vistas** (secciones del shell): clase `view` + `is-active`, toggled por `shell.navigate` según
  `data-view`. Nunca tocar esto a mano: navegar es `bus.emit('nav:goto', {view})`.
- **Todo lo demás** (paneles, modales, bloques condicionales): atributo `hidden`
  (`$('ov-overlay').hidden = false`, `dlBtn.hidden = nSel === 0`).

## Prefijos de ids por vista (tabla real de index.html)

| Vista / zona | Prefijos e ids |
|---|---|
| Shell | `win-*` (+`-2`), `nav`, `section-title`, `theme-toggle`, `session-banner`, `banner-*`, `toast-host` |
| Descargar | `url-input`, `link-count`, `btn-analyze`, `btn-download`, `btn-recents`, `recent-panel`, `preview-*`, `mode-cards`, `video-opts`, `audio-opts`, `folder-path`, `sel-count`, `est-total`, `options-summary`, `btn-*` |
| Modal por-video | `ov-*` |
| Buscar | `search-*`, `btn-search-*` |
| Cola | `queue-*`, `btn-clear-done`, `btn-retry-all` |
| Mi YouTube | `yt-*`, `acc-*`, `btn-yt-*` |
| Biblioteca | `library-*`, `btn-open-downloads`, `btn-clear-history` |
| Ajustes | `set-*`, `fix-*`, `btn-repair` |
| Onboarding | `onb-*` |
| Modal genérico | `modal-*` |

Vista nueva ⇒ prefijo nuevo. Grupos de chips usan `data-group="camelCase"` (`setQuality`, `ovMode`).

## Estilos: inline con CSS vars (nunca hex directos)

Sin clases por componente: estilos inline en el template usando las vars de `core/theme.ts`
(cambiar de tema repinta solo). Vars disponibles:

| Var | Uso |
|---|---|
| `--bg` `--bg2` `--side` `--panel` `--panel2` | Fondos (app, sidebar, tarjetas, elevado) |
| `--hover` `--border` `--border2` | Hover y bordes (2 = más marcado) |
| `--text` `--text2` `--text3` | Texto principal / secundario / terciario |
| `--accent` `--accentText` `--accentSoft` | Violeta de marca, texto sobre acento, fondo suave |
| `--success/--warn/--danger/--info` + `*Soft` | Semánticos y sus fondos suaves (badges, toasts) |
| `--shadow` | Sombra de paneles elevados |

Clases utilitarias globales (stash.css): `.hov` (hover genérico), `.acc-btn` (botón acento),
`.view`/`.is-active`, `.seg`, `.chips`, `.nav-btn`. Animaciones: `spin`, `barflow`, `pulsedot`, `toastin`.
Monoespaciada para números/rutas/urls: `font-family:'JetBrains Mono',monospace`.

## Iconos: registro `I`

`shared/ui/icons.ts` — `I.download`, `I.youtube`, `I.queue`, `I.library`, `I.settings`, `I.sun/moon`,
`I.film/music/video/spark`, `I.check/spinner/alert`, `I.pause/play/x/retry/folder/trash/search/play20`…
SVG inline con `currentColor` (heredan el color del contenedor). Icono nuevo → añadirlo al registro,
no incrustar el SVG en la vista (los del nav van a 18px).
