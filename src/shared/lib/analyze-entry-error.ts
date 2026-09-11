/** Failure reported by `analyze_urls` for one URL (the command never rejects per URL). */
export interface AnalyzeEntryError {
  message: string;
  /** YouTube rejected the session (expired/invalid cookies, bot check, login wall). */
  auth: boolean;
}

const GENERIC_PREFIX = 'error:';
const AUTH_PREFIX = 'error:auth:';

/** Minimal shape shared by every slice's local `VideoMetaDTO`. */
interface EntryLike {
  id?: string;
  availability?: string;
  is_playlist?: boolean;
}

/** Decodes the backend's error-entry convention (`availability` = `error: …` / `error:auth: …`). */
export function parseAnalyzeEntryError(availability: string | undefined): AnalyzeEntryError | null {
  if (!availability) return null;
  if (availability.startsWith(AUTH_PREFIX)) {
    return { message: availability.slice(AUTH_PREFIX.length).trim(), auth: true };
  }
  if (availability.startsWith(GENERIC_PREFIX)) {
    return { message: availability.slice(GENERIC_PREFIX.length).trim(), auth: false };
  }
  return null;
}

/** First error entry of a batch, or null. Error entries are id-less top-level videos. */
export function findAnalyzeEntryError(entries: readonly EntryLike[]): AnalyzeEntryError | null {
  for (const e of entries) {
    if (e.is_playlist || e.id) continue;
    const err = parseAnalyzeEntryError(e.availability);
    if (err) return err;
  }
  return null;
}
