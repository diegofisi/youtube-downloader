import { invoke, onEvent, type UnlistenFn } from '../../core/tauri/client';
import type { DependencyStatus, SetupProgress } from './setup.types';

// Re-export: onSetupProgress consumers need to type the unlisten without
// touching core/tauri/client directly (rule: invoke only in *.api.ts).
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
