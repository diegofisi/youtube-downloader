/** Feed entry of My YouTube (video, or playlist row in the "Playlists" tab). */
export interface FeedVideo {
  id: string;
  url: string;
  title: string;
  channel: string;
  duration?: number;
  thumbnail?: string;
  /** Video count when the flat entry is a playlist (playlists feed) and yt-dlp reports it. */
  playlistCount?: number;
}
