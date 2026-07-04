import type { LibraryEntry } from '../../models/library-entry.model';

/** Mirror of Rust `LibraryEntry` (serde renames video_id/file_path to camelCase). */
export interface LibraryEntryDTOResponse {
  id: string;
  videoId?: string;
  thumbnail?: string;
  /** Duration in seconds. */
  duration?: number;
  filePath?: string;
  url: string;
  title: string;
  format: string;
  folder: string;
  /** Unix timestamp in seconds. */
  date: number;
}

export const toLibraryEntry = (dto: LibraryEntryDTOResponse): LibraryEntry => ({
  id: dto.id,
  videoId: dto.videoId,
  thumbnail: dto.thumbnail,
  duration: dto.duration,
  filePath: dto.filePath,
  url: dto.url,
  title: dto.title,
  format: dto.format,
  folder: dto.folder,
  date: new Date(dto.date * 1000),
});

export const toLibraryEntries = (dtos: LibraryEntryDTOResponse[]): LibraryEntry[] =>
  dtos.map(toLibraryEntry);
