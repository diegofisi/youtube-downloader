import { SessionStatus } from '../../models/session-status.model';

/** Mirror of the Rust command's serialized value (a bare string). */
export type SessionStatusDTOResponse = 'none' | 'expired' | 'connected';

/** Defensive mapping: an unknown value must never leak out as SessionStatus. */
export const toSessionStatus = (dto: SessionStatusDTOResponse): SessionStatus => {
  if (dto === SessionStatus.Connected) return SessionStatus.Connected;
  if (dto === SessionStatus.Expired) return SessionStatus.Expired;
  return SessionStatus.None;
};
