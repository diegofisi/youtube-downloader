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
  /** Nº de videos si la entrada plana es una playlist (feed de playlists) y yt-dlp lo reporta. */
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
