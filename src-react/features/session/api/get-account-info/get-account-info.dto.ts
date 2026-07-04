import type { AccountInfo } from '../../models/account-info.model';

/** Mirror of Rust AccountInfo (serde camelCase). Null = no session / no account. */
export interface AccountInfoDTOResponse {
  name: string;
  handle: string | null;
  avatarUrl: string | null;
}

export const toAccountInfo = (dto: AccountInfoDTOResponse | null): AccountInfo | null =>
  dto ? { name: dto.name, handle: dto.handle, avatarUrl: dto.avatarUrl } : null;
