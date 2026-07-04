/** Mirror of Rust DownloadResult (serde camelCase). Consumed only by the queue
 * scheduler, which works on raw fields — no separate model needed. */
export interface DownloadResultDTOResponse {
  success: boolean;
  error?: string;
  /** Failure classification: session/cookies ("auth"), persistent 403 ("cache"), or other. */
  errorKind?: 'auth' | 'cache' | 'other';
  /** Absolute path of the final downloaded file (if it could be captured). */
  filePath?: string;
}
