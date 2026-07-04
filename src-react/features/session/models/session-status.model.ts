/** YouTube session status — const object + type (never a TS enum). */
export const SessionStatus = {
  None: 'none',
  Expired: 'expired',
  Connected: 'connected',
} as const;
export type SessionStatus = (typeof SessionStatus)[keyof typeof SessionStatus];
