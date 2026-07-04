import type { SearchVideo } from '../../models/search-video.model';

/** Mirror of Rust VideoMeta (flat analyze_urls entry, snake_case serde). */
export interface VideoMetaDTO {
  id: string;
  url: string;
  title: string;
  channel: string;
  duration?: number;
  thumbnail?: string;
  playlist_count?: number;
  flat: boolean;
  is_playlist: boolean;
}

/** Mirror of Rust PlaylistMeta (expanded playlist entry). */
export interface PlaylistMetaDTO {
  id: string;
  url: string;
  title: string;
  channel: string;
  count: number;
  entries: VideoMetaDTO[];
  is_playlist: boolean;
}

export type AnalyzedEntryDTO = VideoMetaDTO | PlaylistMetaDTO;

/** Expands playlists into their entries and drops id-less rows (ports dl-actions flatten). */
export function flattenEntries(entries: AnalyzedEntryDTO[]): VideoMetaDTO[] {
  const out: VideoMetaDTO[] = [];
  for (const e of entries) {
    if (e.is_playlist && 'entries' in e) out.push(...e.entries);
    else out.push(e as VideoMetaDTO);
  }
  return out.filter((v) => v.id);
}

export const toSearchVideo = (dto: VideoMetaDTO): SearchVideo => ({
  id: dto.id,
  url: dto.url,
  title: dto.title,
  channel: dto.channel,
  duration: dto.duration,
  thumbnail: dto.thumbnail,
});
