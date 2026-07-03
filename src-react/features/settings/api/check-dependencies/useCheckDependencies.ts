import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { invoke } from '@/shared/lib/tauri';
import type { DependencyStatus } from '../../models/dependency-status.model';
import { toDependencyStatus, type DependencyStatusDTOResponse } from './check-dependencies.dto';

// Local hook for the Troubleshooting panel. Key is settings-scoped so the future
// setup feature's ['setup', 'dependencies'] query never collides (guideline §4.15).
export function useCheckDependencies(
  options?: Omit<
    UseQueryOptions<DependencyStatusDTOResponse, Error, DependencyStatus>,
    'queryKey' | 'queryFn' | 'select'
  >,
) {
  return useQuery<DependencyStatusDTOResponse, Error, DependencyStatus>({
    queryKey: ['settings', 'dependencies'],
    queryFn: () => invoke<DependencyStatusDTOResponse>('check_dependencies'),
    select: toDependencyStatus,
    ...options,
  });
}
