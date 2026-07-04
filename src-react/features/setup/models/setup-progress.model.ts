/** Payload of the `setup-progress` Tauri event (already camelCase in Rust). */
export interface SetupProgress {
  step: string;
  percent: number;
  message: string;
}
