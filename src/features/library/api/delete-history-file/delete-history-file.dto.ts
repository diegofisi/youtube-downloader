import { DeleteFileOutcome } from '../../models/delete-file-outcome.model';

export type DeleteHistoryFileDTOResponse = 'trash' | 'permanent' | 'no_file';

export const toDeleteFileOutcome = (dto: DeleteHistoryFileDTOResponse): DeleteFileOutcome => {
  if (dto === 'trash') return DeleteFileOutcome.Trash;
  if (dto === 'permanent') return DeleteFileOutcome.Permanent;
  return DeleteFileOutcome.NoFile;
};
