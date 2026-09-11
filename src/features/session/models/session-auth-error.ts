/** YouTube rejected the session (expired/invalid cookies, bot check, login wall). */
export class SessionAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SessionAuthError';
  }
}

export const isSessionAuthError = (e: unknown): e is SessionAuthError => e instanceof SessionAuthError;
