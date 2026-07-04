export const DeleteFileOutcome = {
  Trash: 'trash',
  Permanent: 'permanent',
  NoFile: 'no_file',
} as const;

export type DeleteFileOutcome = (typeof DeleteFileOutcome)[keyof typeof DeleteFileOutcome];
