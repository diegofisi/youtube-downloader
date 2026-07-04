import { describe, it, expect } from 'vitest';
import { DEFAULT_OPTS, type DownloadOpts, type DownloadDefaults } from '../models/download-opts.model';
import { optsToBackend, fmtDescription, sizeMB, effectiveOpts, applyDefaults, qualityLabel } from './opts';

// i18n defaults to 'es' with no localStorage, so translated labels are Spanish.

const MB = 1048576;

function mkOpts(partial: Partial<DownloadOpts> = {}): DownloadOpts {
  return { ...DEFAULT_OPTS, ...partial };
}

function mkDefaults(partial: Partial<DownloadDefaults> = {}): DownloadDefaults {
  return {
    quality: 'max',
    container: 'mp4',
    mode: 'video',
    template: '',
    subtitles: false,
    thumbnail: true,
    clearLinksAfterPreview: false,
    ...partial,
  };
}

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

  it('la calidad "max" usa la etiqueta traducida', () => {
    expect(fmtDescription(mkOpts({ mode: 'av', quality: 'max', container: 'MP4' }))).toBe('Máxima · MP4');
  });
});

describe('qualityLabel', () => {
  it('traduce "max" y deja pasar valores desconocidos', () => {
    expect(qualityLabel('max')).toBe('Máxima');
    expect(qualityLabel('4k')).toBe('4K');
    expect(qualityLabel('desconocida')).toBe('desconocida');
  });
});

describe('sizeMB', () => {
  it('a 1080p devuelve el tamaño base sin factor', () => {
    expect(sizeMB({ sizeBytes: 100 * MB }, mkOpts({ quality: '1080p', mode: 'av' }))).toBeCloseTo(100);
  });

  it('aplica el factor de calidad relativo a 1080p', () => {
    expect(sizeMB({ sizeBytes: 100 * MB }, mkOpts({ quality: '4k', mode: 'av' }))).toBeCloseTo(260);
    expect(sizeMB({ sizeBytes: 100 * MB }, mkOpts({ quality: '480p', mode: 'av' }))).toBeCloseTo(30);
  });

  it('en modo audio aplica ×0.08 sobre el tamaño a esa calidad', () => {
    expect(sizeMB({ sizeBytes: 100 * MB }, mkOpts({ quality: '1080p', mode: 'audio' }))).toBeCloseTo(8);
  });

  it('sin sizeBytes devuelve 0', () => {
    expect(sizeMB({}, mkOpts())).toBe(0);
  });
});

describe('effectiveOpts', () => {
  it('mezcla las opciones globales con el override parcial del video', () => {
    const eff = effectiveOpts(mkOpts(), { quality: '720p' });
    expect(eff.quality).toBe('720p');
    expect(eff.container).toBe(DEFAULT_OPTS.container);
  });

  it('sin override devuelve una copia de las globales', () => {
    const globals = mkOpts();
    const eff = effectiveOpts(globals, undefined);
    expect(eff).toEqual(globals);
    expect(eff).not.toBe(globals);
  });
});

describe('applyDefaults', () => {
  it('mapea calidad/contenedor del formato settings al de la vista', () => {
    const next = applyDefaults(mkOpts(), mkDefaults({ quality: '2160', container: 'mkv' }));
    expect(next.quality).toBe('4k');
    expect(next.container).toBe('MKV');
  });

  it('valores ilegibles conservan los actuales', () => {
    const current = mkOpts({ quality: '720p', container: 'WebM' });
    const next = applyDefaults(current, mkDefaults({ quality: '???', container: 'avi' }));
    expect(next.quality).toBe('720p');
    expect(next.container).toBe('WebM');
  });

  it('el modo "audio" se respeta y cualquier otro cae a "av"', () => {
    expect(applyDefaults(mkOpts(), mkDefaults({ mode: 'audio' })).mode).toBe('audio');
    expect(applyDefaults(mkOpts({ mode: 'audio' }), mkDefaults({ mode: 'video' })).mode).toBe('av');
  });

  it('una plantilla en blanco conserva la actual; subs/thumb se copian', () => {
    const next = applyDefaults(
      mkOpts({ template: '%(title)s' }),
      mkDefaults({ template: '  ', subtitles: true, thumbnail: false }),
    );
    expect(next.template).toBe('%(title)s');
    expect(next.subs).toBe(true);
    expect(next.thumb).toBe(false);
  });
});
