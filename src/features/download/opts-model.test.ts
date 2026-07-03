import { describe, it, expect, afterEach } from 'vitest';
import type { VideoMeta } from '../preview';
import {
  optsToBackend,
  fmtDescription,
  sizeMB,
  effectiveOpts,
  opts,
  overrides,
  pruneOverrides,
  type Opts,
} from './opts-model';

const MB = 1048576;

function mkOpts(partial: Partial<Opts> = {}): Opts {
  return {
    mode: 'av',
    quality: 'max',
    container: 'MP4',
    audioFmt: 'MP3',
    bitrate: '320',
    subs: false,
    thumb: true,
    template: '%(title)s [%(id)s]',
    ...partial,
  };
}

function mkVideo(url: string, sizeBytes?: number): VideoMeta {
  return {
    id: 'vid1',
    url,
    title: 'T',
    channel: 'C',
    size_bytes: sizeBytes,
    flat: false,
    is_playlist: false,
  };
}

// opts/overrides are module state: clear overrides after each test.
afterEach(() => {
  for (const k of Object.keys(overrides)) delete overrides[k];
});

describe('optsToBackend', () => {
  it('mapea los modos de la UI a los del backend (av→video, video→videoonly, audio→audio)', () => {
    expect(optsToBackend(mkOpts({ mode: 'av' }), 'file').mode).toBe('video');
    expect(optsToBackend(mkOpts({ mode: 'video' }), 'file').mode).toBe('videoonly');
    expect(optsToBackend(mkOpts({ mode: 'audio' }), 'file').mode).toBe('audio');
  });

  it('mapea las calidades: max se conserva y 4k pasa a 2160', () => {
    expect(optsToBackend(mkOpts({ quality: 'max' }), 'file').quality).toBe('max');
    expect(optsToBackend(mkOpts({ quality: '4k' }), 'file').quality).toBe('2160');
    expect(optsToBackend(mkOpts({ quality: '720p' }), 'file').quality).toBe('720');
  });

  it('una calidad desconocida cae a "auto"', () => {
    expect(optsToBackend(mkOpts({ quality: 'rarísima' }), 'file').quality).toBe('auto');
  });

  it('mapea contenedor y formato de audio a minúsculas del backend', () => {
    const b = optsToBackend(mkOpts({ container: 'WebM', audioFmt: 'Opus' }), 'file');
    expect(b.container).toBe('webm');
    expect(b.audioFormat).toBe('opus');
  });

  it('parsea el bitrate a número y cae a 0 si no es numérico', () => {
    expect(optsToBackend(mkOpts({ bitrate: '320' }), 'file').audioBitrate).toBe(320);
    expect(optsToBackend(mkOpts({ bitrate: 'auto' }), 'file').audioBitrate).toBe(0);
  });

  it('una plantilla en blanco viaja como undefined', () => {
    expect(optsToBackend(mkOpts({ template: '   ' }), 'file').outputTemplate).toBeUndefined();
    expect(optsToBackend(mkOpts({ template: '%(title)s' }), 'file').outputTemplate).toBe('%(title)s');
  });

  it('propaga cookieMode tal cual', () => {
    expect(optsToBackend(mkOpts(), 'none').cookieMode).toBe('none');
  });
});

describe('fmtDescription', () => {
  it('en audio describe formato y bitrate', () => {
    expect(fmtDescription(mkOpts({ mode: 'audio', audioFmt: 'M4A', bitrate: '192' }))).toBe('M4A · 192');
  });

  it('en video describe calidad y contenedor', () => {
    expect(fmtDescription(mkOpts({ mode: 'av', quality: '1080p', container: 'MKV' }))).toBe('1080p · MKV');
  });
});

describe('sizeMB', () => {
  const URL = 'https://youtu.be/vid1';

  it('a 1080p devuelve el tamaño base sin factor', () => {
    overrides[URL] = { quality: '1080p', mode: 'av' };
    expect(sizeMB(mkVideo(URL, 100 * MB))).toBeCloseTo(100);
  });

  it('aplica el factor de calidad relativo a 1080p', () => {
    overrides[URL] = { quality: '4k', mode: 'av' };
    expect(sizeMB(mkVideo(URL, 100 * MB))).toBeCloseTo(260); // 4k = x2.6
    overrides[URL] = { quality: '480p', mode: 'av' };
    expect(sizeMB(mkVideo(URL, 100 * MB))).toBeCloseTo(30); // 480p = x0.3
  });

  it('en modo audio aplica ×0.08 sobre el tamaño a esa calidad', () => {
    overrides[URL] = { quality: '1080p', mode: 'audio' };
    expect(sizeMB(mkVideo(URL, 100 * MB))).toBeCloseTo(8);
  });

  it('sin size_bytes devuelve 0', () => {
    expect(sizeMB(mkVideo(URL))).toBe(0);
  });
});

describe('pruneOverrides', () => {
  it('conserva los overrides del lote nuevo y descarta el resto', () => {
    overrides['u1'] = { quality: '720p' };
    overrides['u2'] = { mode: 'audio' };
    pruneOverrides(new Set(['u1']));
    expect(overrides['u1']).toEqual({ quality: '720p' });
    expect(overrides['u2']).toBeUndefined();
  });
});

describe('effectiveOpts', () => {
  it('mezcla las opciones globales con el override parcial del video', () => {
    overrides['u1'] = { quality: '720p' };
    const eff = effectiveOpts('u1');
    expect(eff.quality).toBe('720p');
    expect(eff.container).toBe(opts.container); // the rest comes from the globals
  });

  it('sin override devuelve las globales', () => {
    expect(effectiveOpts('sin-override')).toEqual({ ...opts });
  });
});
