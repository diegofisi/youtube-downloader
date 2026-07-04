import type { AnalyzedEntry, AnalyzedPlaylist, AnalyzedVideo } from '../../models/analyzed.model';

// Mirror of the Rust preview structs (serde snake_case) — copy reality, map below.

export interface VideoMetaDTO {
  id: string;
  url: string;
  title: string;
  channel: string;
  duration?: number;
  thumbnail?: string;
  view_count?: number;
  availability?: string;
  size_bytes?: number;
  playlist_count?: number;
  flat: boolean;
  is_playlist: boolean;
}

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

const toAnalyzedVideo = (dto: VideoMetaDTO): AnalyzedVideo => ({
  id: dto.id,
  url: dto.url,
  title: dto.title,
  channel: dto.channel,
  duration: dto.duration,
  thumbnail: dto.thumbnail,
  availability: dto.availability,
  sizeBytes: dto.size_bytes,
  isPlaylist: false,
});

const toAnalyzedPlaylist = (dto: PlaylistMetaDTO): AnalyzedPlaylist => ({
  id: dto.id,
  url: dto.url,
  title: dto.title,
  channel: dto.channel,
  count: dto.count,
  entries: dto.entries.map(toAnalyzedVideo),
  isPlaylist: true,
});

export const toAnalyzedEntry = (dto: AnalyzedEntryDTO): AnalyzedEntry => {
  // Discriminate like vanilla: only real playlists carry an entries array.
  if (dto.is_playlist && 'entries' in dto && Array.isArray(dto.entries)) return toAnalyzedPlaylist(dto);
  return toAnalyzedVideo(dto as VideoMetaDTO);
};
