import type { DependencyStatus } from '../../models/dependency-status.model';

/** Mirror of Rust `DependencyStatus` (single-word fields — no casing to clean). */
export interface DependencyStatusDTOResponse {
  ytdlp: boolean;
  ffmpeg: boolean;
  deno: boolean;
  ready: boolean;
}

export const toDependencyStatus = (dto: DependencyStatusDTOResponse): DependencyStatus => ({
  ytdlp: dto.ytdlp,
  ffmpeg: dto.ffmpeg,
  deno: dto.deno,
  ready: dto.ready,
});
