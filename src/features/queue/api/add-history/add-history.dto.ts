export interface AddHistoryMeta {
  videoId?: string;
  thumbnail?: string;
  /** Duration in seconds. */
  duration?: number;
  /** Absolute path of the downloaded file. */
  filePath?: string;
}

/** Queue only reads `folder`; the library slice owns the full DTO for this struct. */
export interface AddHistoryDTOResponse {
  id: string;
  url: string;
  title: string;
  format: string;
  folder: string;
  date: number; // unix seconds
  videoId?: string;
  thumbnail?: string;
  duration?: number;
  filePath?: string;
}
