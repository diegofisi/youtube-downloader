export interface VideoMeta {
  id: string;
  url: string;
  title: string;
  channel: string;
  duration?: number;
  thumbnail?: string;
  view_count?: number;
  availability?: string;
  size_bytes?: number;
  /** Video count when the flat entry is a playlist (playlists feed) and yt-dlp reports it. */
  playlist_count?: number;
  flat: boolean;
  is_playlist: boolean;
}

export interface PlaylistMeta {
  id: string;
  url: string;
  title: string;
  channel: string;
  count: number;
  entries: VideoMeta[];
  is_playlist: boolean;
}

export type AnalyzedEntry = VideoMeta | PlaylistMeta;
