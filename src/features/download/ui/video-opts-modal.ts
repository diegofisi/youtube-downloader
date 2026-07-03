import { t } from '../../../core/i18n';
import { $ } from '../../../shared/ui/dom';
import { toggleStyle, knob, renderChipGroup } from '../../../shared/ui/controls';
import { opts, overrides } from '../opts-model';
import type { Opts } from '../opts-model';
import { allVideos, renderPreview } from './preview-render';

// ---------- per-video options modal ----------
let ovUrl: string | null = null;
// Override draft: changes are applied to `overrides` only on "Done";
// closing via X / Escape / backdrop discards them.
let ovDraft: Partial<Opts> | null = null;

/** Is the modal open? (so descargar.ts prioritizes closing it on Escape). */
export function isVideoOptsOpen(): boolean {
  return !$('ov-overlay').hidden;
}

export function openVideoOpts(url: string): void {
  ovUrl = url;
  const v = allVideos().find((x) => x.url === url);
  $('ov-title').textContent = v?.title ?? url;
  ovDraft = { ...(overrides[url] || {}) };
  $('ov-overlay').hidden = false;
  // The "Advanced" section starts collapsed on every open.
  $('ov-adv-body').hidden = true;
  $('ov-adv-arrow').style.transform = '';
  const paint = () => {
    const eff = { ...opts, ...(ovDraft || {}) };
    $('ov-video-block').hidden = eff.mode === 'audio';
    $('ov-audio-block').hidden = eff.mode !== 'audio';
    renderChipsInto(
      'ovMode',
      [
        ['av', t('Video + audio', 'Video + audio')],
        ['video', t('Solo video', 'Video only')],
        ['audio', t('Solo audio', 'Audio only')],
      ],
      eff.mode,
      (val) => setOv('mode', val),
    );
    renderChipsInto(
      'ovQuality',
      [
        ['max', t('Máxima', 'Max')],
        ['4k', '4K'],
        ['1440p', '1440p'],
        ['1080p', '1080p'],
        ['720p', '720p'],
        ['480p', '480p'],
      ],
      eff.quality,
      (val) => setOv('quality', val),
    );
    renderChipsInto(
      'ovContainer',
      [
        ['MP4', 'MP4'],
        ['MKV', 'MKV'],
        ['WebM', 'WebM'],
      ],
      eff.container,
      (val) => setOv('container', val),
    );
    renderChipsInto(
      'ovAudioFmt',
      [
        ['MP3', 'MP3'],
        ['M4A', 'M4A'],
        ['Opus', 'Opus'],
      ],
      eff.audioFmt,
      (val) => setOv('audioFmt', val),
    );
    renderChipsInto(
      'ovBitrate',
      [
        ['128', '128'],
        ['192', '192'],
        ['256', '256'],
        ['320', '320'],
      ],
      eff.bitrate,
      (val) => setOv('bitrate', val),
    );
    // Advanced: subs / thumbnail / template — also edit only the draft. Uses .onclick/.oninput
    // (not addEventListener) to avoid stacking listeners across repaints and modal opens.
    const paintTgl = (id: string, key: 'subs' | 'thumb') => {
      const btn = $<HTMLButtonElement>(id);
      const on = !!eff[key];
      btn.setAttribute('style', toggleStyle(on));
      btn.innerHTML = knob;
      btn.dataset.on = on ? '1' : '0';
      btn.onclick = () => {
        ovDraft = { ...(ovDraft || {}), [key]: !on };
        paint();
      };
    };
    paintTgl('ov-toggle-subs', 'subs');
    paintTgl('ov-toggle-thumb', 'thumb');
    const tplIn = $<HTMLInputElement>('ov-template');
    if (document.activeElement !== tplIn) tplIn.value = eff.template;
    tplIn.oninput = () => {
      ovDraft = { ...(ovDraft || {}), template: tplIn.value };
      $('ov-clear').hidden = false; // no repaint: don't interrupt typing
    };
    $('ov-clear').hidden = Object.keys(ovDraft || {}).length === 0;
  };
  const setOv = <K extends keyof Opts>(k: K, val: Opts[K]) => {
    const draft: Partial<Opts> = { ...(ovDraft || {}) };
    draft[k] = val;
    ovDraft = draft;
    paint();
  };
  paint();
}

export function closeVideoOpts(commit: boolean): void {
  if (commit && ovUrl && ovDraft) {
    if (Object.keys(ovDraft).length > 0) overrides[ovUrl] = ovDraft;
    else delete overrides[ovUrl];
  }
  ovUrl = null;
  ovDraft = null;
  $('ov-overlay').hidden = true;
  renderPreview(); // resyncs the gear icon and override badge
}

/** Per-video modal chips: no self-repaint (paint() repaints the whole modal). */
function renderChipsInto<T extends string>(
  group: string,
  list: [T, string][],
  curVal: string,
  onPick: (v: T) => void,
): void {
  renderChipGroup(group, list, () => curVal, onPick, { rerender: false });
}

/** Static modal wiring: "Done" applies the draft; X / backdrop cancel.
 * (Escape lives in descargar.ts, which coordinates priority with the Recents panel.) */
export function initVideoOptsModal(): void {
  $('ov-close').addEventListener('click', () => closeVideoOpts(false));
  $('ov-done').addEventListener('click', () => closeVideoOpts(true));
  $('ov-clear').addEventListener('click', () => {
    if (ovUrl) delete overrides[ovUrl];
    ovUrl = null;
    ovDraft = null;
    $('ov-overlay').hidden = true;
    renderPreview();
  });
  $('ov-overlay').addEventListener('click', (e) => {
    if (e.target === $('ov-overlay')) closeVideoOpts(false);
  });
  // Modal's "Advanced" collapsible (arrow rotates when open).
  $('ov-adv-toggle').addEventListener('click', () => {
    const body = $('ov-adv-body');
    body.hidden = !body.hidden;
    $('ov-adv-arrow').style.transform = body.hidden ? '' : 'rotate(90deg)';
  });
}
