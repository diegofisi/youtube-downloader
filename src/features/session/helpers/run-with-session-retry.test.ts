import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionAuthError } from '../models/session-auth-error';

const reconnect = vi.fn<() => Promise<boolean>>();
vi.mock('../api/refresh-session-silent/attemptSilentReconnect', () => ({
  attemptSilentReconnect: () => reconnect(),
}));

const { runWithSessionRetry } = await import('./run-with-session-retry');

describe('runWithSessionRetry', () => {
  beforeEach(() => reconnect.mockReset());

  it('devuelve el resultado sin tocar la sesión cuando la tarea funciona', async () => {
    await expect(runWithSessionRetry(() => Promise.resolve(1))).resolves.toBe(1);
    expect(reconnect).not.toHaveBeenCalled();
  });

  it('reintenta una vez cuando la sesión se renueva en silencio', async () => {
    reconnect.mockResolvedValue(true);
    const task = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new SessionAuthError('cookies are no longer valid'))
      .mockResolvedValueOnce('ok');
    await expect(runWithSessionRetry(task)).resolves.toBe('ok');
    expect(task).toHaveBeenCalledTimes(2);
  });

  it('propaga el error de sesión cuando la reconexión falla', async () => {
    reconnect.mockResolvedValue(false);
    const task = vi.fn(() => Promise.reject(new SessionAuthError('login required')));
    await expect(runWithSessionRetry(task)).rejects.toBeInstanceOf(SessionAuthError);
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('no intenta reconectar ante errores que no son de sesión', async () => {
    const task = vi.fn(() => Promise.reject(new Error('Video unavailable')));
    await expect(runWithSessionRetry(task)).rejects.toThrow('Video unavailable');
    expect(reconnect).not.toHaveBeenCalled();
  });
});
