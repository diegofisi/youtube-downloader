export interface LibraryEntry {
  id: string;
  /** Id del video (p. ej. id de YouTube), independiente de la URL exacta. */
  videoId?: string;
  thumbnail?: string;
  /** Duración en segundos. */
  duration?: number;
  /** Ruta absoluta del archivo descargado (si se pudo capturar). */
  filePath?: string;
  url: string;
  title: string;
  format: string;
  folder: string;
  date: number; // unix segundos
}
