import { describe, it, expect, vi, beforeEach } from 'vitest';

const invoke = vi.fn<() => Promise<boolean>>();
vi.mock('@/shared/lib/tauri', () => ({ invoke: () => invoke() }));

const { queryClient } = await import('@/shared/lib/query-client');
const { attemptSilentReconnect, resetSilentReconnectCooldown } = await import('./attemptSilentReconnect');

describe('attemptSilentReconnect', () => {
  beforeEach(() => {
    invoke.mockReset();
    resetSilentReconnectCooldown();
    queryClient.clear();
    queryClient.setQueryData(['session', 'status'], 'expired');
  });

  it('never opens the hidden window without a stored session', async () => {
    queryClient.setQueryData(['session', 'status'], 'none');
    await expect(attemptSilentReconnect()).resolves.toBe(false);
    expect(invoke).not.toHaveBeenCalled();
  });

  it('after a failure, later calls short-circuit until the cooldown is reset', async () => {
    invoke.mockResolvedValue(false);
    await expect(attemptSilentReconnect()).resolves.toBe(false);
    await expect(attemptSilentReconnect()).resolves.toBe(false);
    expect(invoke).toHaveBeenCalledTimes(1);

    resetSilentReconnectCooldown();
    invoke.mockResolvedValue(true);
    await expect(attemptSilentReconnect()).resolves.toBe(true);
    expect(invoke).toHaveBeenCalledTimes(2);
  });

  it('a success leaves no cooldown behind', async () => {
    invoke.mockResolvedValue(true);
    await attemptSilentReconnect();
    invoke.mockResolvedValue(false);
    await attemptSilentReconnect();
    expect(invoke).toHaveBeenCalledTimes(2);
  });

  it('shares one in-flight attempt between concurrent callers', async () => {
    let resolve!: (v: boolean) => void;
    invoke.mockReturnValue(new Promise<boolean>((r) => (resolve = r)));
    const a = attemptSilentReconnect();
    const b = attemptSilentReconnect();
    resolve(true);
    await expect(Promise.all([a, b])).resolves.toEqual([true, true]);
    expect(invoke).toHaveBeenCalledTimes(1);
  });
});
