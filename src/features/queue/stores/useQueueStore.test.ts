import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DownloadOptions } from '../models/download-options.model';
import type { EnqueueItem } from '../models/queue-item.model';

// Mocks the api wrappers + the '@/features/session' facade; sonner and the query
// client are side-effect sinks. i18n is pure and used real (defaults to 'es').
const mocks = vi.hoisted(() => ({
  startDownload: vi.fn(),
  cancelDownload: vi.fn(),
  addHistory: vi.fn(),
  getDownloadFolder: vi.fn(),
  openHistoryFolder: vi.fn(),
  attemptSilentReconnect: vi.fn(),
  invalidateQueries: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

vi.mock('../api/start-download/startDownload', () => ({ startDownload: mocks.startDownload }));
vi.mock('../api/cancel-download/cancelDownload', () => ({ cancelDownload: mocks.cancelDownload }));
vi.mock('../api/add-history/addHistory', () => ({ addHistory: mocks.addHistory }));
vi.mock('../api/get-download-folder/getDownloadFolder', () => ({ getDownloadFolder: mocks.getDownloadFolder }));
vi.mock('../api/open-history-folder/openHistoryFolder', () => ({ openHistoryFolder: mocks.openHistoryFolder }));
vi.mock('@/features/session', () => ({ attemptSilentReconnect: mocks.attemptSilentReconnect }));
vi.mock('@/shared/lib/query-client', () => ({ queryClient: { invalidateQueries: mocks.invalidateQueries } }));
vi.mock('sonner', () => ({ toast: mocks.toast }));

type StoreModule = typeof import('./useQueueStore');
type Store = StoreModule['useQueueStore'];

// The module holds state outside the store (seq, auth single-flight), so each
// test re-imports it fresh via vi.resetModules().
async function loadStore(): Promise<StoreModule> {
  return await import('./useQueueStore');
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

function mkItem(url: string): EnqueueItem {
  return { url, title: `Título de ${url}`, channel: 'Canal', grad: 'g1', fmt: 'MP4 · Máxima', options: OPTS };
}

function items(S: Store) {
  return S.getState().items;
}

function progress(S: Store, url: string, percent: number, status: 'downloading' | 'processing' = 'downloading') {
  S.getState().handleProgress({ url, percent, speed: '2.5MiB/s', eta: '00:42', status });
}

/** Flushes pending microtasks/timers (run()'s chained .then callbacks). */
async function flush(): Promise<void> {
  for (let i = 0; i < 4; i++) await new Promise((r) => setTimeout(r, 0));
}

/** startDownload that never resolves: items stay "downloading". */
function eternalDownload(): void {
  mocks.startDownload.mockReturnValue(new Promise(() => {}));
}

beforeEach(() => {
  vi.resetModules();
  mocks.startDownload.mockReset();
  mocks.cancelDownload.mockReset().mockResolvedValue(undefined);
  mocks.addHistory.mockReset().mockResolvedValue({ folder: 'C:\\HistorialFolder' });
  mocks.getDownloadFolder.mockReset().mockResolvedValue('C:\\Descargas');
  mocks.openHistoryFolder.mockReset().mockResolvedValue(undefined);
  mocks.attemptSilentReconnect.mockReset();
  mocks.invalidateQueries.mockReset().mockResolvedValue(undefined);
  for (const fn of Object.values(mocks.toast)) fn.mockReset();
});

describe('enqueue (dedupe)', () => {
  it('rechaza una URL ya encolada o activa', async () => {
    const { useQueueStore: S } = await loadStore();
    eternalDownload();
    S.getState().enqueue([mkItem('https://youtu.be/a')]);
    S.getState().enqueue([mkItem('https://youtu.be/a')]);
    expect(items(S)).toHaveLength(1);
    expect(mocks.toast.warning).toHaveBeenCalledWith('Ya está en la cola', expect.anything());
  });

  it('permite re-encolar una URL cuya descarga ya terminó (done)', async () => {
    const { useQueueStore: S } = await loadStore();
    mocks.startDownload.mockResolvedValue({ success: true });
    S.getState().enqueue([mkItem('https://youtu.be/a')]);
    await flush();
    expect(items(S)[0].status).toBe('done');

    eternalDownload();
    S.getState().enqueue([mkItem('https://youtu.be/a')]);
    expect(items(S)).toHaveLength(2);
  });

  it('permite re-encolar una URL que falló (error)', async () => {
    const { useQueueStore: S } = await loadStore();
    mocks.startDownload.mockResolvedValue({ success: false, error: 'boom' });
    S.getState().enqueue([mkItem('https://youtu.be/a')]);
    await flush();
    expect(items(S)[0].status).toBe('error');
    expect(items(S)[0].error).toBe('boom');

    eternalDownload();
    S.getState().enqueue([mkItem('https://youtu.be/a')]);
    expect(items(S)).toHaveLength(2);
  });
});

describe('pump (concurrencia)', () => {
  it('no lanza más descargas que la concurrencia configurada', async () => {
    const { useQueueStore: S } = await loadStore();
    eternalDownload();
    S.getState().setConcurrency(2);
    S.getState().enqueue([mkItem('u1'), mkItem('u2'), mkItem('u3')]);
    expect(mocks.startDownload).toHaveBeenCalledTimes(2);
    expect(items(S).map((i) => i.status)).toEqual(['downloading', 'downloading', 'queued']);
  });

  it('al terminar una descarga arranca la siguiente en cola', async () => {
    const { useQueueStore: S } = await loadStore();
    let finishFirst!: (r: { success: boolean }) => void;
    mocks.startDownload
      .mockReturnValueOnce(new Promise((r) => (finishFirst = r)))
      .mockReturnValue(new Promise(() => {}));
    S.getState().setConcurrency(1);
    S.getState().enqueue([mkItem('u1'), mkItem('u2')]);
    expect(mocks.startDownload).toHaveBeenCalledTimes(1);

    finishFirst({ success: true });
    await flush();
    expect(mocks.startDownload).toHaveBeenCalledTimes(2);
    expect(items(S).map((i) => i.status)).toEqual(['done', 'downloading']);
  });

  it('concurrencia <= 0 significa sin límite (Infinity)', async () => {
    const { useQueueStore: S } = await loadStore();
    eternalDownload();
    S.getState().setConcurrency(0);
    expect(S.getState().concurrency).toBe(Infinity);
    S.getState().enqueue([mkItem('u1'), mkItem('u2'), mkItem('u3'), mkItem('u4')]);
    expect(mocks.startDownload).toHaveBeenCalledTimes(4);
  });
});

describe('handleProgress', () => {
  it('actualiza progreso/velocidad y pasa a merging con status processing', async () => {
    const { useQueueStore: S } = await loadStore();
    eternalDownload();
    S.getState().enqueue([mkItem('u1')]);
    progress(S, 'u1', 42);
    expect(items(S)[0].progress).toBe(42);
    expect(items(S)[0].speed).toBe('2.5MiB/s');

    progress(S, 'u1', 99, 'processing');
    expect(items(S)[0].status).toBe('merging');
  });

  it('ignora eventos de URLs sin item activo', async () => {
    const { useQueueStore: S } = await loadStore();
    eternalDownload();
    S.getState().enqueue([mkItem('u1')]);
    progress(S, 'otra-url', 50);
    expect(items(S)[0].progress).toBe(0);
  });
});

describe('fallo de auth (sesión caducada)', () => {
  it('pausa el item fallido y también los que siguen en cola', async () => {
    const { useQueueStore: S } = await loadStore();
    mocks.startDownload
      .mockResolvedValueOnce({ success: false, errorKind: 'auth' })
      .mockReturnValue(new Promise(() => {}));
    mocks.attemptSilentReconnect.mockResolvedValue(false);
    S.getState().setConcurrency(1);
    S.getState().enqueue([mkItem('u1'), mkItem('u2'), mkItem('u3')]);
    await flush();

    const [i1, i2, i3] = items(S);
    expect(i1.status).toBe('paused');
    expect(i1.pausedByAuth).toBe(true);
    expect(i2.status).toBe('paused');
    expect(i3.status).toBe('paused');
    // None of the paused items were ever launched.
    expect(mocks.startDownload).toHaveBeenCalledTimes(1);
    expect(mocks.toast.warning).toHaveBeenCalled();
  });

  it('si la reconexión silenciosa funciona, reencola los pausados por auth', async () => {
    const { useQueueStore: S } = await loadStore();
    mocks.startDownload
      .mockResolvedValueOnce({ success: false, errorKind: 'auth' })
      .mockReturnValue(new Promise(() => {}));
    mocks.attemptSilentReconnect.mockResolvedValue(true);
    S.getState().setConcurrency(1);
    S.getState().enqueue([mkItem('u1'), mkItem('u2')]);
    await flush();

    // After session renewal, pump relaunches: u1 (re-queued) downloads again.
    expect(mocks.attemptSilentReconnect).toHaveBeenCalledTimes(1);
    expect(mocks.startDownload).toHaveBeenCalledTimes(2);
    expect(items(S).some((i) => i.pausedByAuth)).toBe(false);
  });
});

describe('resume vs retry', () => {
  it('reanudar conserva el progreso (yt-dlp continúa el .part)', async () => {
    const { useQueueStore: S } = await loadStore();
    eternalDownload();
    S.getState().enqueue([mkItem('u1')]);
    progress(S, 'u1', 42);
    expect(items(S)[0].progress).toBe(42);

    S.getState().action(items(S)[0].id, 'pause');
    expect(items(S)[0].status).toBe('paused');
    expect(mocks.cancelDownload).toHaveBeenCalledWith('u1');

    S.getState().action(items(S)[0].id, 'resume');
    await flush();
    expect(items(S)[0].status).toBe('downloading'); // pump relaunched it
    expect(items(S)[0].progress).toBe(42); // progress is NOT lost
  });

  it('reintentar resetea el progreso a 0', async () => {
    const { useQueueStore: S } = await loadStore();
    let fail!: (r: { success: boolean; error: string }) => void;
    mocks.startDownload.mockReturnValueOnce(new Promise((r) => (fail = r))).mockReturnValue(new Promise(() => {}));
    S.getState().enqueue([mkItem('u1')]);
    progress(S, 'u1', 77);
    fail({ success: false, error: 'se cayó' });
    await flush();

    expect(items(S)[0].status).toBe('error');
    expect(items(S)[0].progress).toBe(77); // error keeps the visual progress

    S.getState().action(items(S)[0].id, 'retry');
    await flush();
    expect(items(S)[0].progress).toBe(0); // retry DOES start from zero
    expect(items(S)[0].error).toBeUndefined();
  });
});

describe('runSeq (liquidaciones obsoletas)', () => {
  it('un startDownload viejo que resuelve tras pause→resume no pisa la nueva ejecución', async () => {
    const { useQueueStore: S } = await loadStore();
    let settleStale!: (r: { success: boolean }) => void;
    mocks.startDownload
      .mockReturnValueOnce(new Promise((r) => (settleStale = r)))
      .mockReturnValue(new Promise(() => {}));
    S.getState().enqueue([mkItem('u1')]);
    const id = items(S)[0].id;

    S.getState().action(id, 'pause');
    S.getState().action(id, 'resume');
    await flush();
    expect(items(S)[0].status).toBe('downloading'); // second run owns the item
    expect(mocks.startDownload).toHaveBeenCalledTimes(2);

    settleStale({ success: true }); // first run settles late
    await flush();
    expect(items(S)[0].status).toBe('downloading'); // NOT marked done by the stale run
    expect(mocks.addHistory).not.toHaveBeenCalled();
  });

  it('si resuelve mientras sigue pausado, el item permanece pausado', async () => {
    const { useQueueStore: S } = await loadStore();
    let settle!: (r: { success: boolean }) => void;
    mocks.startDownload.mockReturnValueOnce(new Promise((r) => (settle = r)));
    S.getState().enqueue([mkItem('u1')]);
    S.getState().action(items(S)[0].id, 'pause');

    settle({ success: true });
    await flush();
    expect(items(S)[0].status).toBe('paused');
    expect(mocks.addHistory).not.toHaveBeenCalled();
  });
});

describe('abrir carpeta (parentDir y cadena de fallbacks)', () => {
  it('con filePath abre la carpeta contenedora del archivo (separador \\)', async () => {
    const { useQueueStore: S } = await loadStore();
    mocks.startDownload.mockResolvedValue({ success: true, filePath: 'C:\\Users\\yo\\Videos\\clip.mp4' });
    S.getState().enqueue([mkItem('u1')]);
    await flush();

    S.getState().action(items(S)[0].id, 'folder');
    await flush();
    expect(mocks.openHistoryFolder).toHaveBeenCalledWith('C:\\Users\\yo\\Videos');
  });

  it('soporta rutas con separador /', async () => {
    const { useQueueStore: S } = await loadStore();
    mocks.startDownload.mockResolvedValue({ success: true, filePath: '/home/yo/videos/clip.mp4' });
    S.getState().enqueue([mkItem('u1')]);
    await flush();

    S.getState().action(items(S)[0].id, 'folder');
    await flush();
    expect(mocks.openHistoryFolder).toHaveBeenCalledWith('/home/yo/videos');
  });

  it('sin filePath cae a la carpeta del historial', async () => {
    const { useQueueStore: S } = await loadStore();
    mocks.startDownload.mockResolvedValue({ success: true });
    S.getState().enqueue([mkItem('u1')]);
    await flush();
    expect(items(S)[0].folder).toBe('C:\\HistorialFolder');

    S.getState().action(items(S)[0].id, 'folder');
    await flush();
    expect(mocks.openHistoryFolder).toHaveBeenCalledWith('C:\\HistorialFolder');
  });

  it('sin filePath ni folder cae a la carpeta de descargas', async () => {
    const { useQueueStore: S } = await loadStore();
    eternalDownload();
    S.getState().enqueue([mkItem('u1')]);

    S.getState().action(items(S)[0].id, 'folder');
    await flush();
    expect(mocks.getDownloadFolder).toHaveBeenCalledTimes(1);
    expect(mocks.openHistoryFolder).toHaveBeenCalledWith('C:\\Descargas');
  });
});

describe('limpieza y estado agregado', () => {
  it('clearFinished saca done/canceled pero conserva los error', async () => {
    const { useQueueStore: S } = await loadStore();
    mocks.startDownload
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: false, error: 'x' })
      .mockReturnValue(new Promise(() => {}));
    S.getState().enqueue([mkItem('u1'), mkItem('u2'), mkItem('u3')]);
    await flush();
    S.getState().action(items(S)[2].id, 'cancel');

    S.getState().clearFinished();
    expect(items(S).map((i) => i.status)).toEqual(['error']);
  });

  it('retryAllFailed reencola solo los fallidos y resetea su progreso', async () => {
    const { useQueueStore: S } = await loadStore();
    mocks.startDownload
      .mockResolvedValueOnce({ success: false, error: 'x' })
      .mockResolvedValueOnce({ success: true })
      .mockReturnValue(new Promise(() => {}));
    S.getState().setConcurrency(2);
    S.getState().enqueue([mkItem('u1'), mkItem('u2')]);
    await flush();
    expect(items(S).map((i) => i.status)).toEqual(['error', 'done']);

    S.getState().retryAllFailed();
    await flush();
    expect(items(S)[0].status).toBe('downloading'); // re-queued and relaunched
    expect(items(S)[1].status).toBe('done'); // the completed one is untouched
  });

  it('selectActiveCount cuenta solo los items vivos (badge de la barra lateral)', async () => {
    const { useQueueStore: S, selectActiveCount } = await loadStore();
    mocks.startDownload.mockResolvedValueOnce({ success: true }).mockReturnValue(new Promise(() => {}));
    S.getState().setConcurrency(1);
    S.getState().enqueue([mkItem('u1'), mkItem('u2'), mkItem('u3')]);
    await flush();
    // u1 done (not live); u2 downloading + u3 queued are live.
    expect(selectActiveCount(S.getState())).toBe(2);
  });
});
