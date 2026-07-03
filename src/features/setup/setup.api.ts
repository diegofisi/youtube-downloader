import { invoke, onEvent, type UnlistenFn } from '../../core/tauri/client';
import type { DependencyStatus, SetupProgress } from './setup.types';

// Re-export: los consumidores de onSetupProgress necesitan tipar el unlisten
// sin tocar core/tauri/client directamente (regla: invoke solo en *.api.ts).
export type { UnlistenFn };

export async function checkDependencies(): Promise<DependencyStatus> {
  return invoke<DependencyStatus>('check_dependencies');
}

export async function downloadDependencies(): Promise<void> {
  return invoke('download_dependencies');
}

export function onSetupProgress(cb: (data: SetupProgress) => void): Promise<UnlistenFn> {
  return onEvent<SetupProgress>('setup-progress', cb);
}
