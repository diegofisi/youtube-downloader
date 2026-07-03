# UI patterns (vanilla TS, no framework)

## The base pattern: innerHTML + rebind with `data-*`

Every list/grid is repainted whole and rewired afterwards. State never lives in the DOM:

```ts
function renderList(): void {
  closeAnchoredMenu();                       // an open menu's anchor stops existing on repaint
  $('{pfx}-list').innerHTML = items.map((it) => `
    <button data-url="${esc(it.url)}" style="…">${esc(it.title)}</button>`).join('');
  $('{pfx}-list').querySelectorAll<HTMLElement>('[data-url]').forEach((b) =>
    b.addEventListener('click', () => onPick(b.dataset.url!)),
  );
}
```

- STATIC buttons (they exist in index.html) are wired ONCE in `init{Name}()`.
- Inside a `paint()` that re-runs (modals), use `.onclick`/`.oninput` instead of
  `addEventListener` to avoid accumulating listeners across repaints (video-opts-modal.ts).
- **`esc()` is mandatory** for every interpolated dynamic value (titles, URLs, error messages:
  `Error: ${esc(String(e))}`). Only skipped for your own literals and icons from the `I` registry.

## Real shared components (signatures and when to use them)

| Component | Signature | When |
|---|---|---|
| `dom.$` | `$<T extends HTMLElement>(id): T` — throws if missing | Always, instead of getElementById (fails loudly and typed) |
| `toast.showToast` | `(title, body = '', kind: 'done'\|'warn'\|'info'\|'error' = 'done', ms = 4200)` | Non-blocking feedback. Short title + detail in body |
| `modal.showModal` | `(title, message, showCancel = false): Promise<boolean>` | Destructive confirmations (clear history, delete file) |
| `media-card.videoCard` | `(v: CardMedia, selected: boolean): string` | Grid card (Search / My YouTube). Minimal structural type: VideoMeta satisfies it |
| `media-card.wireVideoCards` | `(list, items, { toggle(url), download(anchor, item) })` | Rewire checkbox and ⬇ button after painting the grid |
| `media-card.stateCard / loadingCard` | `(title, msg, actionHtml = '')` / `(labelHtml)` | Empty/error states and the grid's loading row |
| `media-card.renderPillBar` | `(el, items {key,label}[], active, onPick)` | Filter tabs/chips (does not re-render itself: onPick repaints) |
| `paged-loader.createPagedLoader` | `({ pageSize, key, fetchPage(start,end), moreButtonId, onPage })` | Any "Load more" paginated list against `analyzeUrls(range)` |
| `anchored-menu.openAnchoredMenu` | `(anchor, items {icon?,label,color?,onPick}[])` | Context menu anchored to a button (toggle, click-outside, Escape, viewport clamp) |
| `controls.renderChipGroup` | `(groupSel, [value,label][], get, onPick, {pad?, rerender?, after?})` — paints into `[data-group="…"]` | Chip groups (quality, container…) |
| `controls.renderSeg / renderToggle` | `(id, list, get, set)` / `(id, get, set)` | Settings-style segmented controls / on-off switches |
| `gradients.gradFor / CARD_GRAD` | `(id): string` stable hash-based gradient / fixed gradient | Background for imageless thumbnails |
| `format.fmtDuration / fmtSize / timeAgo / fmtDate` | see shared/lib/format.ts | Duration `h:mm:ss`, MB/GB, "X ago", locale-aware date |
| `dl-actions.*` | `flatten, defaultOptions, toQueueItem, openDlMenu, downloadSelected, customizeSelected` | ONLY for Search/My YouTube-style grids (download/customize flow) |

## Anti-race pagination: `begin()` + `loadSeq`

The paged-loader encapsulates `nextStart/hasMore/loadingMore/loadSeq`. Each view orchestrates
the first page itself (its own loading/empty/error); subsequent ones are handled by the
"Ver más" button:

```ts
const loader = createPagedLoader<VideoMeta>({
  pageSize: 50,
  key: (v) => v.id || v.url,                       // dedupe when the feed shifts between pages
  fetchPage: async (start, end) => ({ items: flatten(await analyzeUrls([srcUrl()], { start, end })) }),
  moreButtonId: '{pfx}-more',
  onPage: () => renderList(),
});
loader.wireMore();                                  // once, in init

async function load(): Promise<void> {
  const seq = loader.begin();                       // invalidates previous loads
  pintarLoading();
  try {
    if ((await loader.loadFirst(seq)) === 'stale') return;   // arrived late: discard
    renderList();
  } catch (e) { pintarError(e); }                   // stale errors do NOT land here
}
```
If the view filters client-side, pass `rawCount` in the result so `hasMore` is computed
against the raw count (search-view.ts).

## Single-flight

For operations several callers may trigger at once, share the promise/flag:
- `session.state::attemptSilentReconnect` — stores `silentReconnectInFlight: Promise<boolean> | null`.
- `queue.state::handleAuthFailure` — boolean flag `authReconnectInFlight`.
- `account-card::ensureAccountInfo` — caches the promise and discards the result if invalidated
  (`if (p !== accountInfoPromise) return;`).

## Modal drafts (apply only on confirm)

`video-opts-modal.ts`: changes edit `ovDraft` (a copy of the override); "Listo" commits to
`overrides[url]`; X / Escape / backdrop discard. An empty draft DELETES the override
(`delete overrides[url]`). Text inputs are not repainted while focused
(`if (document.activeElement !== tplIn) tplIn.value = …`).

## Visibility: `hidden` vs `.is-active`

- **Views** (shell sections): class `view` + `is-active`, toggled by `shell.navigate` based on
  `data-view`. Never touch this by hand: navigation is `bus.emit('nav:goto', {view})`.
- **Everything else** (panels, modals, conditional blocks): the `hidden` attribute
  (`$('ov-overlay').hidden = false`, `dlBtn.hidden = nSel === 0`).

## Id prefixes per view (real table from index.html)

| View / zone | Prefixes and ids |
|---|---|
| Shell | `win-*` (+`-2`), `nav`, `section-title`, `theme-toggle`, `session-banner`, `banner-*`, `toast-host` |
| Descargar | `url-input`, `link-count`, `btn-analyze`, `btn-download`, `btn-recents`, `recent-panel`, `preview-*`, `mode-cards`, `video-opts`, `audio-opts`, `folder-path`, `sel-count`, `est-total`, `options-summary`, `btn-*` |
| Per-video modal | `ov-*` |
| Search | `search-*`, `btn-search-*` |
| Queue | `queue-*`, `btn-clear-done`, `btn-retry-all` |
| My YouTube | `yt-*`, `acc-*`, `btn-yt-*` |
| Library | `library-*`, `btn-open-downloads`, `btn-clear-history` |
| Settings | `set-*`, `fix-*`, `btn-repair` |
| Onboarding | `onb-*` |
| Generic modal | `modal-*` |

New view ⇒ new prefix. Chip groups use `data-group="camelCase"` (`setQuality`, `ovMode`).

## Styles: inline with CSS vars (never raw hex)

No per-component classes: inline styles in the template using the vars from `core/theme.ts`
(switching themes repaints on its own). Available vars:

| Var | Use |
|---|---|
| `--bg` `--bg2` `--side` `--panel` `--panel2` | Backgrounds (app, sidebar, cards, elevated) |
| `--hover` `--border` `--border2` | Hover and borders (2 = stronger) |
| `--text` `--text2` `--text3` | Primary / secondary / tertiary text |
| `--accent` `--accentText` `--accentSoft` | Brand violet, text on accent, soft background |
| `--success/--warn/--danger/--info` + `*Soft` | Semantics and their soft backgrounds (badges, toasts) |
| `--shadow` | Elevated panel shadow |

Global utility classes (stash.css): `.hov` (generic hover), `.acc-btn` (accent button),
`.view`/`.is-active`, `.seg`, `.chips`, `.nav-btn`. Animations: `spin`, `barflow`, `pulsedot`, `toastin`.
Monospace for numbers/paths/urls: `font-family:'JetBrains Mono',monospace`.

## Icons: the `I` registry

`shared/ui/icons.ts` — `I.download`, `I.youtube`, `I.queue`, `I.library`, `I.settings`, `I.sun/moon`,
`I.film/music/video/spark`, `I.check/spinner/alert`, `I.pause/play/x/retry/folder/trash/search/play20`…
Inline SVG with `currentColor` (they inherit the container's color). New icon → add it to the
registry, don't embed the SVG in the view (nav icons render at 18px).
