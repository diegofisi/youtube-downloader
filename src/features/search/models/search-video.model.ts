/** Search result video, trimmed to what the Buscar view renders and enqueues. */
export interface SearchVideo {
  id: string;
  url: string;
  title: string;
  channel: string;
  duration?: number;
  thumbnail?: string;
}
