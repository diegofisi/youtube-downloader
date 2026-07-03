import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DownloadOptions } from '../download';

// Se mockean las FACHADAS que importa queue.state (efectos de otros slices);
// el bus y la i18n son puros y se usan reales. El módulo tiene estado global
// (items/seq), así que cada test lo importa fresco con vi.resetModules().
const mocks = vi.hoisted(() => ({
  startDownload: vi.fn(),
  cancelDownload: vi.fn(),
  addHistory: vi.fn(),
  openHistoryFolder: vi.fn(),
  getDownloadFolder: vi.fn(),
  attemptSilentReconnect: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock('../download', () => ({
  startDownload: mocks.startDownload,
  cancelDownload: mocks.cancelDownload,
}));
vi.mock('../library', () => ({
  addHistory: mocks.addHistory,
  openHistoryFolder: mocks.openHistoryFolder,
}));
vi.mock('../settings', () => ({ getDownloadFolder: mocks.getDownloadFolder }));
vi.mock('../session', () => ({ attemptSilentReconnect: mocks.attemptSilentReconnect }));
vi.mock('../../shared/ui/toast', () => ({ showToast: mocks.showToast }));

type QueueModule = typeof import('./queue.state');

async function cargarCola(): Promise<QueueModule> {
  return await import('./queue.state');
}

const OPTS: DownloadOptions = {
  mode: 'video',
  quality: 'max',
  container: 'mp4',
  audioFormat: 'mp3',
  audioBitrate: 320,
  subtitles: false,
  subLangs: 'es,en',
  embedThumbnail: true,
  cookieMode: 'file',
};

function mkItem(url: string) {
  return { url, title: `Título de ${url}`, channel: 'Canal', grad: 'g1', fmt: 'MP4 · Máxima', options: OPTS };
}

/** Deja correr los microtasks/timers pendientes (los .then encadenados de run()). */
async function flush(): Promise<void> {
  for (let i = 0; i < 4; i++) await new Promise((r) => setTimeout(r, 0));
}

/** startDownload que nunca termina: los items quedan "downloading". */
function descargaEterna(): void {
  mocks.startDownload.mockReturnValue(new Promise(() => {}));
}

beforeEach(() => {
  vi.resetModules();
  for (const m of Object.values(mocks)) m.mockReset();
  mocks.cancelDownload.mockResolvedValue(undefined);
  mocks.addHistory.mockResolvedValue({ folder: 'C:\\HistorialFolder' });
  mocks.openHistoryFolder.mockResolvedValue(undefined);
  mocks.getDownloadFolder.mockResolvedValue('C:\\Descargas');
});

describe('enqueue (dedupe)', () => {
  it('rechaza URL ya encolada o activa', async () => {
    const q = await cargarCola();
    descargaEterna();
    q.enqueue([mkItem('https://youtu.be/a')]);
    q.enqueue([mkItem('https://youtu.be/a')]);
    expect(q.getItems()).toHaveLength(1);
    expect(mocks.showToast).toHaveBeenCalledWith('Ya está en la cola', expect.any(String), 'warn');
  });

  it('permite re-encolar una URL cuya descarga ya terminó (done)', async () => {
    const q = await cargarCola();
    mocks.startDownload.mockResolvedValue({ success: true });
    q.enqueue([mkItem('https://youtu.be/a')]);
    await flush();
    expect(q.getItems()[0].status).toBe('done');

    descargaEterna();
    q.enqueue([mkItem('https://youtu.be/a')]);
    expect(q.getItems()).toHaveLength(2);
  });

  it('permite re-encolar una URL que falló (error)', async () => {
    const q = await cargarCola();
    mocks.startDownload.mockResolvedValue({ success: false, error: 'boom' });
    q.enqueue([mkItem('https://youtu.be/a')]);
    await flush();
    expect(q.getItems()[0].status).toBe('error');
    expect(q.getItems()[0].error).toBe('boom');

    descargaEterna();
    q.enqueue([mkItem('https://youtu.be/a')]);
    expect(q.getItems()).toHaveLength(2);
  });
});

describe('pump (concurrencia)', () => {
  it('no lanza más descargas que la concurrencia configurada', async () => {
    const q = await cargarCola();
    descargaEterna();
    q.setConcurrency(2);
    q.enqueue([mkItem('u1'), mkItem('u2'), mkItem('u3')]);
    expect(mocks.startDownload).toHaveBeenCalledTimes(2);
    const estados = q.getItems().map((i) => i.status);
    expect(estados).toEqual(['downloading', 'downloading', 'queued']);
  });

  it('al terminar una descarga arranca la siguiente en cola', async () => {
    const q = await cargarCola();
    let terminaPrimera!: (r: { success: boolean }) => void;
    mocks.startDownload
      .mockReturnValueOnce(new Promise((r) => (terminaPrimera = r)))
      .mockReturnValue(new Promise(() => {}));
    q.setConcurrency(1);
    q.enqueue([mkItem('u1'), mkItem('u2')]);
    expect(mocks.startDownload).toHaveBeenCalledTimes(1);

    terminaPrimera({ success: true });
    await flush();
    expect(mocks.startDownload).toHaveBeenCalledTimes(2);
    expect(q.getItems().map((i) => i.status)).toEqual(['done', 'downloading']);
  });

  it('concurrencia <= 0 significa sin límite', async () => {
    const q = await cargarCola();
    descargaEterna();
    q.setConcurrency(0);
    q.enqueue([mkItem('u1'), mkItem('u2'), mkItem('u3'), mkItem('u4')]);
    expect(mocks.startDownload).toHaveBeenCalledTimes(4);
  });
});

describe('fallo de auth (sesión caducada)', () => {
  it('pausa el item fallido y también los que siguen en cola', async () => {
    const q = await cargarCola();
    mocks.startDownload
      .mockResolvedValueOnce({ success: false, errorKind: 'auth' })
      .mockReturnValue(new Promise(() => {}));
    mocks.attemptSilentReconnect.mockResolvedValue(false);
    q.setConcurrency(1);
    q.enqueue([mkItem('u1'), mkItem('u2'), mkItem('u3')]);
    await flush();

    const [i1, i2, i3] = q.getItems();
    expect(i1.status).toBe('paused');
    expect(i1.pausedByAuth).toBe(true);
    expect(i2.status).toBe('paused');
    expect(i3.status).toBe('paused');
    // Ninguno de los pausados llegó a lanzarse.
    expect(mocks.startDownload).toHaveBeenCalledTimes(1);
  });

  it('si la reconexión silenciosa funciona, reencola los pausados por auth', async () => {
    const q = await cargarCola();
    mocks.startDownload
      .mockResolvedValueOnce({ success: false, errorKind: 'auth' })
      .mockReturnValue(new Promise(() => {}));
    mocks.attemptSilentReconnect.mockResolvedValue(true);
    q.setConcurrency(1);
    q.enqueue([mkItem('u1'), mkItem('u2')]);
    await flush();

    // Tras renovar sesión, el pump relanza: u1 (reencolado) vuelve a bajar.
    expect(mocks.attemptSilentReconnect).toHaveBeenCalledTimes(1);
    expect(mocks.startDownload).toHaveBeenCalledTimes(2);
    expect(q.getItems().some((i) => i.pausedByAuth)).toBe(false);
  });
});

describe('resume vs retry', () => {
  it('reanudar conserva el progreso (yt-dlp continúa el .part)', async () => {
    const q = await cargarCola();
    descargaEterna();
    q.enqueue([mkItem('u1')]);
    q.handleProgress('u1', 42, '2.5MiB/s', '00:42', 'downloading');
    const it = q.getItems()[0];
    expect(it.progress).toBe(42);

    q.action(it.id, 'pause');
    expect(it.status).toBe('paused');
    expect(mocks.cancelDownload).toHaveBeenCalledWith('u1');

    q.action(it.id, 'resume');
    await flush();
    expect(it.status).toBe('downloading'); // el pump lo relanzó
    expect(it.progress).toBe(42); // el avance NO se pierde
  });

  it('reintentar resetea el progreso a 0', async () => {
    const q = await cargarCola();
    let falla!: (r: { success: boolean; error: string }) => void;
    mocks.startDownload.mockReturnValueOnce(new Promise((r) => (falla = r))).mockReturnValue(new Promise(() => {}));
    q.enqueue([mkItem('u1')]);
    q.handleProgress('u1', 77, '1MiB/s', '00:10', 'downloading');
    falla({ success: false, error: 'se cayó' });
    await flush();

    const it = q.getItems()[0];
    expect(it.status).toBe('error');
    expect(it.progress).toBe(77); // el error conserva el avance visual

    q.action(it.id, 'retry');
    await flush();
    expect(it.progress).toBe(0); // retry SÍ parte de cero
    expect(it.error).toBeUndefined();
  });
});

describe('abrir carpeta (parentDir)', () => {
  it('con filePath abre la carpeta contenedora del archivo (separador \\)', async () => {
    const q = await cargarCola();
    mocks.startDownload.mockResolvedValue({ success: true, filePath: 'C:\\Users\\yo\\Videos\\clip.mp4' });
    q.enqueue([mkItem('u1')]);
    await flush();

    q.action(q.getItems()[0].id, 'folder');
    await flush();
    expect(mocks.openHistoryFolder).toHaveBeenCalledWith('C:\\Users\\yo\\Videos');
  });

  it('soporta rutas con separador /', async () => {
    const q = await cargarCola();
    mocks.startDownload.mockResolvedValue({ success: true, filePath: '/home/yo/videos/clip.mp4' });
    q.enqueue([mkItem('u1')]);
    await flush();

    q.action(q.getItems()[0].id, 'folder');
    await flush();
    expect(mocks.openHistoryFolder).toHaveBeenCalledWith('/home/yo/videos');
  });

  it('sin filePath cae a la carpeta del historial', async () => {
    const q = await cargarCola();
    mocks.startDownload.mockResolvedValue({ success: true });
    q.enqueue([mkItem('u1')]);
    await flush();
    expect(q.getItems()[0].folder).toBe('C:\\HistorialFolder');

    q.action(q.getItems()[0].id, 'folder');
    await flush();
    expect(mocks.openHistoryFolder).toHaveBeenCalledWith('C:\\HistorialFolder');
  });
});

describe('limpieza y estado agregado', () => {
  it('clearFinished saca done/canceled pero conserva los error', async () => {
    const q = await cargarCola();
    mocks.startDownload
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: false, error: 'x' })
      .mockReturnValue(new Promise(() => {}));
    q.enqueue([mkItem('u1'), mkItem('u2'), mkItem('u3')]);
    await flush();
    q.action(q.getItems()[2].id, 'cancel');

    q.clearFinished();
    expect(q.getItems().map((i) => i.status)).toEqual(['error']);
  });

  it('retryAllFailed reencola solo los fallidos y resetea su progreso', async () => {
    const q = await cargarCola();
    mocks.startDownload
      .mockResolvedValueOnce({ success: false, error: 'x' })
      .mockResolvedValueOnce({ success: true })
      .mockReturnValue(new Promise(() => {}));
    q.setConcurrency(2);
    q.enqueue([mkItem('u1'), mkItem('u2')]);
    await flush();
    expect(q.getItems().map((i) => i.status)).toEqual(['error', 'done']);

    q.retryAllFailed();
    await flush();
    expect(q.getItems()[0].status).toBe('downloading'); // reencolado y relanzado
    expect(q.getItems()[1].status).toBe('done'); // el completado no se toca
  });
});
