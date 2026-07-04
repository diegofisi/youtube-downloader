# Frontend Improvement Plan — Stash

> Living document. Captures the full findings of the multi-agent frontend audit
> (2026-07-04) so nothing is lost. We review it **point by point** before making
> any change. Each item has a **Status** we update as we go.
>
> Status legend: 🔲 pending review · 🟢 approved · ✍️ in progress · ✅ done · ⛔ rejected

## Locked decisions

- **i18n → migrate to Paraglide JS (inlang).** Stash will scale beyond es/en.
  Migrate now, while only 2 languages exist and the codemod is cheapest. The
  inline `t(es, en)` positional signature does not scale (a 3rd language forces
  editing every call site). See item #5.
- **Typography → single `<Text variant>` + fluid `clamp()` scale** as Tailwind v4
  `--text-*` tokens, consumed via CVA. See item #8.
- **Container/Component boundary → the two universal rules (A + B) in item #3**
  are the accepted doctrine (reviewed & confirmed by Diego).

## Review status (2026-07-04, point by point)

Reviewed with Diego. Approved: #1, #2, #3 (universal rule), #4, #5 (Paraglide),
#6, #7 (keep facades, verify purity), #8 (Text+clamp), #10. Reframed: #9 (DRY,
not count). Added: #11 Tailwind v4 adoptions. Nothing implemented yet — Diego
wants the full review captured first.

## How we measured

Four parallel audit/research agents ran against `src/` and the web:
1. `useEffect`/`useLayoutEffect` classification (every occurrence).
2. Structure: multi-component files, barrel files, class-count offenders.
3. Deep dive: i18n call-site scale, Typography overrides, session container.
4. Web research: React docs + authorities on the 6 debatable questions.

The bar is the existing `frontend` skill doctrine (source of truth). Items that
change **doctrine** are called out explicitly — "improve the skills" is part of
the goal, not only the code.

---

## Findings & actions (point by point)

### #1 — useEffect only for external systems ✅ user is right

**Status: 🟢 approved — do the 3 fixes + doctrine + lint**

**Verdict:** Correct, and it is the official React position — *"Effects let you
step outside React and synchronize with an external system. If there is no
external system involved, you shouldn't need an Effect."* Derived state,
prop-transformation, and user-event responses must never live in an Effect.

**Code state:** Mostly good — 6 legitimate uses (Tauri events, timers, document
listeners), **0 animation effects**. Three real anti-patterns to fix:

| Location | Problem | Fix |
|---|---|---|
| `src/features/download/hooks/useApplySettingsDefaults.ts:10` | Effect watches `defaults`, mutates the store (PROP-SYNC) | Apply in the query's `onSuccess` or an event handler |
| `src/features/download/hooks/useConsumePrefill.ts:10` | Effect watches `pending`, triggers analyze (effect chain) | Consume once in a handler / on mount, not a watcher |
| `src/features/session/containers/SessionExpiredBanner.tsx:20` | Effect resets `dismissed` on reconnect (EFFECT-AS-HANDLER) | Derive in render: `status === Expired && !dismissed` |

**Doctrine change:** Add the official "You Might Not Need an Effect" table to
`references/conventions.md` (derived→render, expensive→`useMemo`, reset-all→`key`,
adjust-some→minimal state + derive, user-action→handler, notify-parent→same
handler, subscribe→`useSyncExternalStore`). Enable ESLint lint
`react-hooks/set-state-in-effect`.

**Refs:** react.dev/learn/you-might-not-need-an-effect ·
react.dev/reference/eslint-plugin-react-hooks/lints/set-state-in-effect

---

### #2 — One component per file ⚠️ already satisfied (user partly wrong)

**Status: 🟢 approved — no code action (folds into #3/#10)**

**Verdict:** No real violations. Apparent "multi-component" files are Shadcn/Radix
composition families (`dialog.tsx`, `card.tsx`, `select.tsx`) — the correct
pattern for headless primitives. `buttonVariants` is a CVA factory, not a
component. `WindowButton` in `Titlebar.tsx` is a ~7-line inline helper, which the
doctrine already permits (<20 JSX lines).

**Action:** None on the code. The session issue the user noticed is item #10
(container-as-view), not a multi-component violation.

---

### #3 — Containers hold logic; components have NO hooks 🟡 over-rigid, doctrine change

**Status: 🟢 approved — universal rule below is the doctrine**

**THE UNIVERSAL RULE (no gray areas) — two parts:**

**Rule A — where state/logic lives.** One-sentence test: *if the state vanished on
remount and nothing outside the component would notice, it lives in the
component; if anything external (server, store, sibling, URL, toast) depends on
it, it lives in the container/hook.* The question is binary — "does anyone
external depend on this state?"

| In the **component** (local, ephemeral, presentational) | In the **container/hook** (data, business, external effects) |
|---|---|
| `useState` for open/hover/focus/expanded/active-visual-tab/own-input draft | Server data (React Query) |
| `useRef`, `useId` | Mutations / writes |
| Outside-click / Escape listener for **its own** popover | Shared/global state (Zustand) |
| CSS animation of its own UI | Business-derived data |
| | `toast`, navigation, `invoke`, any external effect |
| | Orchestrating multiple components |

This corrects the old "props-only, zero hooks" rule AND corrects our own audit:
`UrlInputCard` and `DownloadMenu` (own `open` + own listener) are **fine**.

**Rule B — what a container's JSX may contain (hard, no exceptions):** only
(1) other components, (2) conditional rendering (`&&`, early returns),
(3) fragments, and prop/callback passing. **Forbidden inside a container's JSX:**
layout primitives (`Stack`/`Grid`/`Box`), icons, typography/text/`t()`, styling
`className`/`style`/magic values, `<button>`/inputs/raw HTML. If any appear →
that JSX is a component. This is the line that makes `OnboardingGate` correct and
`SessionExpiredBanner` wrong.

**Original analysis (retained):**

**Verdict:** The north star — Lego blocks, max decoupling + max cohesion, logic in
containers — is right. But the literal *"components have zero hooks"* rule is
**over-rigid and author-retracted**. Dan Abramov on his 2015 article: *"I don't
suggest splitting components like this anymore… enforced with almost dogmatic
fervor far too many times."*

The useful boundary is **data/business vs presentation**, not *all* state vs *no*
state:
- **Up to container/hook:** fetching (React Query), mutations, business state
  (Zustand), derived business data, orchestration.
- **Stays in the component:** local, ephemeral UI state — disclosure toggle,
  hover/focus, "is this menu open", `useRef`, `useId`, the outside-click listener
  of the component's own popover.

**Consequence — corrects our own audit:** the agent flagged
`UrlInputCard.tsx:37` and `DownloadMenu` as "component smell" for holding
`useState` + a listener. Under the refined rule these are **fine** — a dropdown
owning its own `open` and outside-click is legitimately local UI state. Forcing it
up would add prop-drilling and kill reuse.

**Doctrine change (highest-value):** rewrite the components rule in
`references/components.md` / `conventions.md` to: *"Presentational components may
own local, ephemeral, presentation-only state (`useState` for toggles/hover,
`useRef`, `useId`, listeners for their own widget). They never fetch, mutate,
touch stores, or show toasts."* "Zero hooks" becomes a smell, not a hard rule.

**Refs:** medium.com/@dan_abramov/smart-and-dumb-components-7ca2f9a7c7d0 (dep. preface) ·
react.dev/learn/reusing-logic-with-custom-hooks

---

### #4 — useEffect for animations is counterproductive ✅ user is right

**Status: 🟢 approved — add animation doctrine (0 code offenders today)**

**Verdict:** Correct. Effect-driven animation costs an extra commit+repaint cycle
(mount-reveal flicker) and, on lists, layout thrash. CSS/native runs off the
render loop for zero extra renders.

**Code state:** Already clean — 0 animation effects; they use CSS (`animate-spin`).
This is a win to **lock into doctrine** so it stays that way.

**Doctrine change:** Add an animation section (Tauri = known Chromium engine, so
modern APIs are safe). Preference order:
1. CSS transitions/animations for toggles (open/close, hover).
2. `@starting-style` + `transition-behavior: allow-discrete` — the exact
   replacement for "useEffect to animate on mount / out of `display:none`".
3. `view-transition` / React `<ViewTransition>` for reorders and shared-element
   morphs (FLIP without manual measuring).
4. Motion (Framer) only for spring physics / gestures / `layout`.
5. `useLayoutEffect` only for pre-paint measurement (FLIP, tooltip positioning) —
   usually a library already does it.

**Refs:** react.dev/reference/react/useLayoutEffect ·
react.dev/reference/react/ViewTransition ·
developer.mozilla.org/en-US/docs/Web/CSS/@starting-style · motion.dev

---

### #5 — i18n does not scale ✅ right problem, refined solution — DECISION LOCKED

**Status: 🟢 approved — migrate to Paraglide**

**Verdict:** Correct that it does not scale. Hard data: **279 call-sites across 65
files**, verbatim duplication (`t('Descargar','Download')` in **8 places**,
`'No se pudo abrir la carpeta'` in 3). Root cause is not "separate file y/n" — it
is that the **`t(es, en)` signature is positional/2-arg**: a 3rd language forces
editing all 279 sites.

The user's "separate file + object" idea is the hand-rolled typed-key approach —
fine as a stopgap, poor as a destination (reinvents pluralization, ICU
interpolation, per-locale lazy-load).

**Decision (locked): migrate to Paraglide JS now.** Vite-native, compiles to
typed message functions (`m.download()`), tree-shakeable, zero runtime (ideal for
desktop), JSON catalogs a translator/TMS can edit. Efficient under ~20 locales.

**Migration shape (to detail before executing):**
1. Add Paraglide + Vite plugin; set up `messages/{en,es}.json` and compiler output.
2. Codemod: each `t('es','en')` → a message key + two catalog entries. De-dup
   repeated strings into shared keys (kill the 8× `Descargar`, etc.).
3. Wire language switch to the ui store (`stash.lang`) preserving live re-render.
4. Remove `src/shared/lib/i18n.ts` inline helper once call sites are migrated.
5. Update backend-error-string handling note (still Spanish product copy).

**Doctrine change:** In `references/conventions.md` / `project.md`, replace the
"inline `t(es,en)` is the scheme" prescription with the Paraglide keyed-catalog
scheme; note inline tuples were valid only at exactly 2 languages.

**Scope flag:** Large (279 sites). Sequence after the exemplar code fixes.

**Refs:** github.com/opral/paraglide-js · react.i18next.com (fallback considered)

---

### #6 — useReducer vs useState ✅ doctrine already correct

**Status: 🟢 approved — add state hierarchy note

**Verdict:** Existing doctrine is right (*"useReducer is not a useMemo-chain
substitute under RHF; only for genuine state machines"*). Confirmed by React docs.

**Doctrine change (small):** add the full hierarchy — `useState` (simple local) →
`useReducer` (complex local, several handlers driving related transitions, or
recurring bad-update bugs) → **Zustand** (shared/global — not reducer+context) →
**React Query** (server state — never in useState/reducer/Zustand).

**Refs:** react.dev/learn/extracting-state-logic-into-a-reducer ·
react.dev/learn/choosing-the-state-structure

---

### #7 — Barrel files ⚠️ right instinct, repo already clean

**Status: 🟢 approved — keep facades, verify purity**

**Verified mechanism (dev vs prod):**
- **Dev (Vite native ESM):** TRUE — importing one symbol from a barrel fetches +
  evaluates ALL sibling modules it re-exports (ESM spec, no per-export lazy load).
  Vite does NOT mitigate for app source (dep pre-bundling is `node_modules` only).
- **Prod (Rollup/Rolldown):** unused re-exports tree-shake out ONLY if the barrel
  is pure (`export … from` only) AND members have no top-level side effects.
- **The "animations run behind the scenes" fear is mostly a MISCONCEPTION:**
  animation code inside a React component runs at RENDER, not import. Importing an
  unrendered component only *defines* the function. It becomes real ONLY if a
  module does work at module top-level (`registerPlugin(...)`, `new Engine()`,
  side-effect CSS import).

**Verdict for the 3 curated facades:** LOW risk. Worst case bounded by the single
heaviest member, not folder size (that's the auto-generated-barrel nightmare,
which we don't have). Types are free (erased at build).

**Action:** (1) keep the 3 facades **pure** — only `export`/`export type … from`,
no other top-level statements; (2) verify the re-exported components
(`QueueBridge`, `SessionExpiredBanner`) have no module-level side effects;
(3) add `import/no-cycle` lint + a lint lock forbidding any OTHER `index.ts`
(the barrel-slip risk becomes mechanically impossible); (4) on Vite 8 (Rolldown)
don't mix inline exports with re-exports (bug #21966). **Do NOT remove the
existing facades.**

**Vite-specific findings (project is on Vite `^6.0.0`, alias `@ → src` only):**
- The `@/` alias is PURE path resolution — it does NOT affect tree-shaking,
  eager-load, or encapsulation. Three orthogonal concerns: alias (resolution) /
  barrel eager-load (bundler) / encapsulation (`eslint-plugin-boundaries` lint).
- Vite has NEVER natively optimized APP-SOURCE barrels (`optimizeDeps` is
  `node_modules`-only, all versions). Vite's own guidance is manual "import
  individual APIs directly."
- Vite 8/Rolldown adds opt-in `experimental.lazyBarrel` (off by default, needs
  `sideEffects:false`) — not worth enabling for 3 tiny facades.
- The half-remembered "deep import" option is Next.js `optimizePackageImports`
  (barrel→deep rewrite, for `node_modules` packages, opposite direction from the
  boundaries facade rule). Vite has no built-in equivalent; `vite-plugin-barrel`
  is a community port and would be over-engineering here.
- **Verdict: for 3 curated facades on Vite 6 there is nothing to configure — the
  perf cost is negligible; keep them for encapsulation.** Refs: vite.dev/guide/performance ·
  vite.dev/blog/announcing-vite8 · rolldown.rs lazy-barrel · nextjs.org optimizePackageImports

**Refs:** vite.dev/guide/performance · vite.dev/guide/dep-pre-bundling ·
tkdodo.eu/blog/please-stop-using-barrel-files · vitejs/vite#21966 · MDN JS modules

---

### #8 — Typography 🟡 good base, under-specified → new design decided

**Status: 🟢 approved — design below**

**Problem confirmed:** scale too coarse → **83 `text-[Xpx]` overrides** (design uses
11.5/12.5/13.5/15px the current H1–H6/P/Small don't cover). Worst smell: raw magic
values (`text-[12.5px]`, `text-[#241600]`, `gap-2.75`).

**Decided design — single `<Text variant>` + fluid `clamp()` scale (3 layers):**

1. **Tokens (one source of truth)** — Tailwind v4 `@theme` `--text-*` tokens with
   `clamp(MIN, PREFERRED, MAX)` values from the Utopia calculator. Each token
   carries `--text-*--line-height` / `--letter-spacing`. This is the ONLY place
   `clamp()` appears. Solves "gigantic on huge screens": MAX is a hard cap.
   - **A11y (non-negotiable):** PREFERRED must keep a `rem` term (pure `vw` fails
     WCAG 1.4.4 on zoom); keep **MAX ≤ 2.5 × MIN** per token.
2. **Variant registry (CVA)** — same lib Shadcn's Button uses. Axes: `variant`
   (`h1…h6 lead body body-sm small caption overline code`), `tone`
   (`default muted danger success`), `weight`. `defaultVariants: body/default`.
3. **Component** — one polymorphic `<Text>` with a **constrained `as` union**
   (`'h1'|…|'p'|'span'|'label'`), NOT full generic polymorphism (avoids the
   `PolymorphicComponentPropsWithRef` type tax). Each variant maps to a default
   tag (MUI `variantMapping` style). Call site = zero size classes:
   `<Text variant="h1">`, `<Text variant="h1" as="h2">`, `<Text variant="caption" tone="muted">`.

**Kills the 83 overrides** because the variant set is as fine-grained as the real
design; new size = new variant, never `text-[12.5px]`. Line-height/weight/tone
become variant axes. Responsive `md:`/`lg:` chains disappear (clamp is fluid).

**Trade-off (accepted):** clamp removes discrete-breakpoint control — correct for
a single-axis desktop window; `text-[13px]` stays as a rare escape hatch.

**Migration:** retire the 8 components, or keep thin shims
(`H1 = (p) => <Text variant="h1" {...p}/>`) during transition. Update
`references/components.md` typography table + `project.md`.

**CRITICAL GOTCHA (found in testing):** custom Tailwind font-size tokens
(`text-h1`, `text-body`, …) MUST be registered with `tailwind-merge` via
`extendTailwindMerge({ extend: { classGroups: { 'font-size': [{ text: [...] }] }}})`
in `cn` (`shared/lib/utils.ts`). Otherwise tailwind-merge classifies them as text
COLOR and silently DROPS the size when a color class is merged (`text-h1` +
`text-foreground` → `text-foreground`), so headings fall back to the preflight
~14px reset — appearing tiny and non-fluid. This bit us immediately; it's now
fixed. Any new `--text-*` token must be added to that list too.

**Fluid range:** interpolates 768→1920px so headings keep growing on large
desktop windows before capping (a 720→1600 range capped too early and felt
static on big monitors). H1 = 26→40px, body 14→16px.

**Refs:** utopia.fyi/type/calculator · smashingmagazine.com fluid-typography +
accessibility-concerns · mui.com Typography (variantMapping) · cva.style ·
tailwindcss.com/docs/font-size · tailwind-merge extendTailwindMerge docs

---

### #9 — Reduce number of classes 🔁 reframe: it's DRY, not count

**Status: 🟢 approved — DRY via variants**

**Diego's refinement:** a new/unique element with ≤14 classes is fine. But a
**repeated** element must NEVER duplicate its class string across files — that's
double-maintenance. If two versions are genuinely needed, they become **named
variants**. Shared buttons/variants live in `shared/`. Text is the most-duplicated
style → solved by #8's `<Text>`.

**Verdict:** No count bloat — the worst element has ~14 classes. The real problem
is **pattern duplication**: icon-buttons, menu items, and badges hand-written
instead of reusing `Button` variants. Evidence: `ColaPage.tsx:53` & `:63` (same
button, destructive variant, by hand); `DownloadMenu.tsx:55` & `:63` (**identical
className string duplicated**); `LibraryEntryRow.tsx:61`, `PlaylistCard.tsx:35`.

**Action:** Extract reusable primitives — `IconButton`, `MenuItem`, `CardBadge` —
and route hand-rolled buttons through `Button`'s variant system. Fewer classes
falls out as a side effect. Promote to `shared/components/ui/` when reused.

---

### #10 — Session does everything in the container ✅ user is right

**Status: 🟢 approved — exemplar refactor, do first**

**Verdict:** `SessionExpiredBanner.tsx` mixes **~15 lines of logic** with **~31
lines of raw JSX** (Stack + Span + 2 buttons + icons + magic values + a `style`
with `color-mix`). The `session/` feature has **no `components/` folder**,
contrasting with `library/` which cleanly splits `containers/` and `components/`.

**Action (exemplar, do first):** Extract `session/components/SessionExpiredBannerView.tsx`
(dumb view, receives `onReconnect` / `onDismiss`); container shrinks to ~12 lines.
This is the "Lego" pattern applied — a template for the whole refactor.

---

### #11 — Tailwind v4 features under-used (added by Diego)

**Status: 🟢 approved — adopt top items**

**Baseline:** already on v4 CSS-first (no JS config, Vite plugin, auto content
detection). The two-layer palette (`:root` raw vars + `@theme inline`) is the
CORRECT v4 idiom for runtime dark-mode — **do NOT collapse it** (not duplication).

**Ranked adoptions (grep-confirmed unused today):**
1. **Fluid `--text-*` `clamp()` tokens in `@theme`** — same piece as #8. Kills the
   scattered `text-[13.5/12.5/11px]` AND the hand-written `md:`/`lg:` pairs in
   `typography.tsx`. Highest leverage.
2. **Container queries** (`@container` + `@sm:`/`@lg:`) for media/library/playlist
   grids — the correct primitive for a desktop app with fixed sidebar + resizable
   panel; viewport breakpoints are actively wrong (only 18 to replace). Cards
   reflow to the panel's width, not the window's.
3. **Opacity modifier `bg-warn/32`** to kill the inline `color-mix` in
   `SessionExpiredBanner.tsx:39` — one-liner, removes an inline `style`.
   (`QueueItemCard.tsx:141` is dynamic `meta.color` → map to a color enum.)
4. **`@utility badge-soft` / `surface`** — extract the soft-badge + panel patterns
   Button/Typography don't cover (the long tail).
5. **`starting:` / `@starting-style`** for non-Radix reveals (the banner) — JS-free
   enter animation; aligns with #4. Leave Radix `data-[state]` animations as-is.

**Quick win:** `field-sizing-content` on the URL-paste textarea → auto-grow with no
`useEffect`. **Cosmetic:** off-grid spacing (`gap-2.75`, `h-7.5`) — optionally tune
`--spacing` base. **Skip:** 3D transforms, conic gradients, `font-stretch`, `nth-*`.

**Refs:** tailwindcss.com/blog/tailwindcss-v4 · v4 container-queries docs

---

## Prioritized execution order (after point-by-point review)

**Foundation first (unlocks the rest):**
1. 🔴 #8 + #11.1 Build the `<Text>` component + fluid `--text-*` `clamp()` tokens
   in `@theme`. This is the keystone — text is the most-duplicated style, and the
   tokens also serve #11.
2. 🔴 #10 Extract `SessionExpiredBannerView` + create `session/components/` —
   exemplar of Rule A/B; also consumes `<Text>` and `bg-warn/32` (#11.3).

**Code changes (then):**
3. 🔴 #1 Fix the 3 `useEffect` anti-patterns.
4. 🟠 #9 Extract `IconButton` / `MenuItem` / `CardBadge`; route buttons through `Button`.
5. 🟠 #11.2 Container queries for the media/library/playlist grids.
6. 🟠 #11.3/.4/.5 `bg-*/opacity` for inline `color-mix`; `@utility badge-soft`/`surface`;
   `starting:` reveal on the banner; `field-sizing` on the URL textarea.
7. 🟡 #5 (large) Migrate i18n to Paraglide (codemod all `t()` call sites).

**Doctrine changes (improve the `frontend` skill):**
1. 🔴 #3 Rewrite components rule — Rule A (state) + Rule B (container JSX). *(most valuable)*
2. 🔴 #1 Add "You Might Not Need an Effect" table + `set-state-in-effect` lint.
3. 🔴 #8 Replace the typography table with the `<Text>` + `clamp()` design.
4. 🟠 #4 Add animation doctrine (CSS → `@starting-style` → view-transition → Motion).
5. 🟠 #5 Replace inline-i18n prescription with Paraglide keyed catalogs.
6. 🟠 #11 Add a Tailwind v4 usage section (container queries, `@theme` tokens, `@utility`).
7. 🟡 #6 State hierarchy; #7 `import/no-cycle` lint + Vite/barrel nuance.

## What stays (do not touch)

Vertical-slice architecture · adapter pattern (DTO→model) · the 3 facades ·
one-component-per-file (already met) · page/container/component separation ·
`mutate` + callbacks · const-object enums. All solid.
