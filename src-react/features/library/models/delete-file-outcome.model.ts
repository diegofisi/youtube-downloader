/** Result of delete_history_file: where the file actually went. */
export const DeleteFileOutcome = {
  Trash: 'trash',
  Permanent: 'permanent',
  NoFile: 'no_file',
} as const;

export type DeleteFileOutcome = (typeof DeleteFileOutcome)[keyof typeof DeleteFileOutcome];
