import { useMemo } from 'react';
import { useDownloadedKeys } from '../api/get-history/useDownloadedKeys';
import type { AnalyzedPlaylist, FlatVideo } from '../models/analyzed.model';
import type { DownloadOpts } from '../models/download-opts.model';
import { STATUS_META, flattenVideos, statusOf, type VideoStatus } from '../helpers/analysis';
import { effectiveOpts, sizeMB } from '../helpers/opts';
import { useDownloadStore } from '../stores/useDownloadStore';

// View-models for the preview list: components stay dumb, all business
// derivation (status, effective opts, size, selection counts) happens here.

export interface VideoVM {
  video: FlatVideo;
  status: VideoStatus;
  selected: boolean;
  hasOverride: boolean;
  eff: DownloadOpts;
  sizeMb: number;
}

export type PreviewItemVM =
  | { kind: 'video'; vm: VideoVM }
  | {
      kind: 'playlist';
      playlist: AnalyzedPlaylist;
      children: VideoVM[];
      nSel: number;
      nSelectable: number;
      allSelected: boolean;
      expanded: boolean;
      selectableUrls: string[];
    };

const EMPTY_KEYS: ReadonlySet<string> = new Set();

export function usePreviewDerived() {
  const entries = useDownloadStore((s) => s.entries);
  const selected = useDownloadStore((s) => s.selected);
  const overrides = useDownloadStore((s) => s.overrides);
  const opts = useDownloadStore((s) => s.opts);
  const onlyDownloadable = useDownloadStore((s) => s.onlyDownloadable);
  const collapsed = useDownloadStore((s) => s.collapsed);
  const { data: downloadedKeys } = useDownloadedKeys();
  const downloaded = downloadedKeys ?? EMPTY_KEYS;

  const flat = useMemo(() => flattenVideos(entries), [entries]);

  const makeVM = useMemo(
    () =>
      (video: FlatVideo): VideoVM => {
        const eff = effectiveOpts(opts, overrides[video.url]);
        const ov = overrides[video.url];
        return {
          video,
          status: statusOf(video, downloaded),
          selected: selected.has(video.url),
          hasOverride: !!ov && Object.keys(ov).length > 0,
          eff,
          sizeMb: sizeMB(video, eff),
        };
      },
    [opts, overrides, selected, downloaded],
  );

  const items = useMemo<PreviewItemVM[]>(() => {
    const out: PreviewItemVM[] = [];
    // flat mirrors the entries iteration order, so a cursor keeps per-instance dup flags.
    let cursor = 0;
    for (const e of entries) {
      if (e.isPlaylist) {
        const all = e.entries.map(() => makeVM(flat[cursor++]));
        const children = all.filter((vm) => !onlyDownloadable || STATUS_META[vm.status].downloadable);
        const selectable = all.filter((vm) => STATUS_META[vm.status].downloadable);
        const nSel = selectable.filter((vm) => vm.selected).length;
        out.push({
          kind: 'playlist',
          playlist: e,
          children,
          nSel,
          nSelectable: selectable.length,
          allSelected: selectable.length > 0 && nSel === selectable.length,
          expanded: !collapsed[e.id],
          selectableUrls: selectable.map((vm) => vm.video.url),
        });
        continue;
      }
      const vm = makeVM(flat[cursor++]);
      if (onlyDownloadable && !STATUS_META[vm.status].downloadable) continue;
      out.push({ kind: 'video', vm });
    }
    return out;
  }, [entries, flat, makeVM, onlyDownloadable, collapsed]);

  const summary = useMemo(() => {
    const selectableUrls = flat.filter((v) => STATUS_META[statusOf(v, downloaded)].downloadable).map((v) => v.url);
    const chosen = flat.filter((v) => selected.has(v.url) && STATUS_META[statusOf(v, downloaded)].downloadable);
    // How many selected videos carry custom options (non-empty override).
    const customCount = chosen.filter((v) => overrides[v.url] && Object.keys(overrides[v.url]).length > 0).length;
    const estMb = chosen.reduce((a, v) => a + sizeMB(v, effectiveOpts(opts, overrides[v.url])), 0);
    return {
      totalCount: flat.length,
      selectableUrls,
      allOn: selectableUrls.length > 0 && selectableUrls.every((url) => selected.has(url)),
      chosenCount: chosen.length,
      customCount,
      estMb,
    };
  }, [flat, downloaded, selected, overrides, opts]);

  return { items, hasEntries: entries.length > 0, ...summary };
}
