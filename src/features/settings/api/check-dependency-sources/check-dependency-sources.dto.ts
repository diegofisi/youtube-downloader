import type { DependencySource } from '../../models/dependency-source.model';

/** Mirror of Rust `SourceStatus` (camelCase serde). */
export interface SourceStatusDTOResponse {
  name: string;
  url: string;
  ok: boolean;
  detail: string;
}

export const toDependencySource = (dto: SourceStatusDTOResponse): DependencySource => ({
  name: dto.name,
  url: dto.url,
  ok: dto.ok,
  detail: dto.detail,
});
