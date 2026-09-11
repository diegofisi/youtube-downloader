export interface DownloadResultDTOResponse {
  success: boolean;
  error?: string;
  /** Failure classification: session/cookies ("auth"), persistent 403 ("cache"), user cancel, or other. */
  errorKind?: 'auth' | 'cache' | 'other' | 'cancelled';
  /** Absolute path of the final downloaded file (if it could be captured). */
  filePath?: string;
}
