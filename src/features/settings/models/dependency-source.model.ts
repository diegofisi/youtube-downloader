/** Reachability of one pinned download source (yt-dlp, ffmpeg, deno). */
export interface DependencySource {
  name: string;
  url: string;
  ok: boolean;
  /** "HTTP 200", "HTTP 404" or the transport error. */
  detail: string;
}
