/** Human text of a thrown value: `String(err)` would leak the class name ("SessionAuthError: …"). */
export const errorText = (e: unknown): string => (e instanceof Error ? e.message : String(e));
