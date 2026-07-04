import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { invoke } from '@/shared/lib/tauri';
import type { DependencyStatus } from '../../models/dependency-status.model';
import { toDependencyStatus, type DependencyStatusDTOResponse } from './check-dependencies.dto';

export const SETUP_DEPENDENCIES_KEY = ['setup', 'dependencies'] as const;

// Distinct key from settings' ['settings', 'dependencies'] — no cache collision.
export function useCheckDependencies(
  options?: Omit<
    UseQueryOptions<DependencyStatusDTOResponse, Error, DependencyStatus>,
    'queryKey' | 'queryFn' | 'select'
  >,
) {
  return useQuery<DependencyStatusDTOResponse, Error, DependencyStatus>({
    queryKey: SETUP_DEPENDENCIES_KEY,
    queryFn: () => invoke<DependencyStatusDTOResponse>('check_dependencies'),
    select: toDependencyStatus,
    ...options,
  });
}
