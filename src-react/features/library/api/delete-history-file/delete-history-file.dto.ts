import { DeleteFileOutcome } from '../../models/delete-file-outcome.model';

/** Raw string the Rust command returns ("trash" | "permanent" | "no_file"). */
export type DeleteHistoryFileDTOResponse = 'trash' | 'permanent' | 'no_file';

export const toDeleteFileOutcome = (dto: DeleteHistoryFileDTOResponse): DeleteFileOutcome => {
  if (dto === 'trash') return DeleteFileOutcome.Trash;
  if (dto === 'permanent') return DeleteFileOutcome.Permanent;
  return DeleteFileOutcome.NoFile;
};
