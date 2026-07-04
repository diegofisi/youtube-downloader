/** Install state of the bundled tools (yt-dlp, ffmpeg, deno). */
export interface DependencyStatus {
  ytdlp: boolean;
  ffmpeg: boolean;
  deno: boolean;
  ready: boolean;
}
