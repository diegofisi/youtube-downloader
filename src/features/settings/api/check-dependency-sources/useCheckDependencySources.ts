import { useMutation } from '@tanstack/react-query';
import { invoke } from '@/shared/lib/tauri';
import type { DependencySource } from '../../models/dependency-source.model';
import { toDependencySource, type SourceStatusDTOResponse } from './check-dependency-sources.dto';

/** Manual probe of the pinned download URLs (network round-trips: never a background query). */
export function useCheckDependencySources() {
  return useMutation<DependencySource[], Error>({
    mutationFn: async () =>
      (await invoke<SourceStatusDTOResponse[]>('check_dependency_sources')).map(toDependencySource),
  });
}
