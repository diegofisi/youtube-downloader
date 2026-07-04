import { create } from 'zustand';
import type { AnalyzedEntry } from '../models/analyzed.model';
import type { DownloadDefaults, DownloadOpts, OptsOverride } from '../models/download-opts.model';
import { DEFAULT_OPTS } from '../models/download-opts.model';
import { applyDefaults } from '../helpers/opts';
import { mergeLines } from '../helpers/parse-urls';

// Descargar batch state. Lives in a store (not page state) so the preview, selection
// and per-batch overrides survive navigating to /cola and back — vanilla parity.

interface DownloadStore {
  // State
  urlsText: string;
  entries: AnalyzedEntry[];
  selected: ReadonlySet<string>;
  overrides: Record<string, OptsOverride>;
  opts: DownloadOpts;
  onlyDownloadable: boolean;
  /** Playlist id → collapsed (default expanded, like vanilla `expanded[id] !== false`). */
  collapsed: Record<string, boolean>;
  analyzeError: string | null;
  // Actions
  setUrlsText: (text: string) => void;
  appendUrls: (urls: string[]) => void;
  setBatch: (entries: AnalyzedEntry[], selected: Set<string>) => void;
  setAnalyzeError: (message: string | null) => void;
  toggleSelected: (url: string) => void;
  setSelected: (urls: string[], on: boolean) => void;
  clearSelection: () => void;
  setOpts: (patch: Partial<DownloadOpts>) => void;
  applySettingsDefaults: (cfg: DownloadDefaults) => void;
  /** Empty/null override deletes the entry (video falls back to globals). */
  setOverride: (url: string, override: OptsOverride | null) => void;
  toggleOnlyDownloadable: () => void;
  toggleCollapsed: (playlistId: string) => void;
  reset: () => void;
}

const initialState = {
  urlsText: '',
  entries: [] as AnalyzedEntry[],
  selected: new Set<string>() as ReadonlySet<string>,
  overrides: {} as Record<string, OptsOverride>,
  opts: DEFAULT_OPTS,
  onlyDownloadable: false,
  collapsed: {} as Record<string, boolean>,
  analyzeError: null as string | null,
};

/** Overrides are per-batch: drop entries for URLs that left the preview. */
const pruneOverrides = (
  overrides: Record<string, OptsOverride>,
  entries: AnalyzedEntry[],
): Record<string, OptsOverride> => {
  const keep = new Set<string>();
  for (const e of entries) {
    if (e.isPlaylist) for (const v of e.entries) keep.add(v.url);
    if (!e.isPlaylist) keep.add(e.url);
  }
  return Object.fromEntries(Object.entries(overrides).filter(([url]) => keep.has(url)));
};

export const useDownloadStore = create<DownloadStore>((set) => ({
  ...initialState,

  setUrlsText: (urlsText) => set({ urlsText }),
  appendUrls: (urls) => set((s) => ({ urlsText: mergeLines(s.urlsText, urls) })),

  setBatch: (entries, selected) =>
    set((s) => ({
      entries,
      selected,
      overrides: pruneOverrides(s.overrides, entries),
      analyzeError: null,
    })),
  setAnalyzeError: (analyzeError) => set({ analyzeError }),

  toggleSelected: (url) =>
    set((s) => {
      const next = new Set(s.selected);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return { selected: next };
    }),
  setSelected: (urls, on) =>
    set((s) => {
      const next = new Set(s.selected);
      for (const url of urls) if (on) next.add(url);
      for (const url of urls) if (!on) next.delete(url);
      return { selected: next };
    }),
  clearSelection: () => set({ selected: new Set<string>() }),

  setOpts: (patch) => set((s) => ({ opts: { ...s.opts, ...patch } })),
  applySettingsDefaults: (cfg) => set((s) => ({ opts: applyDefaults(s.opts, cfg) })),

  setOverride: (url, override) =>
    set((s) => {
      const next = { ...s.overrides };
      if (override && Object.keys(override).length > 0) next[url] = override;
      else delete next[url];
      return { overrides: next };
    }),

  toggleOnlyDownloadable: () => set((s) => ({ onlyDownloadable: !s.onlyDownloadable })),
  toggleCollapsed: (playlistId) =>
    set((s) => ({ collapsed: { ...s.collapsed, [playlistId]: !s.collapsed[playlistId] } })),

  reset: () => set(initialState),
}));
