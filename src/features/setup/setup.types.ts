export interface DependencyStatus {
  ytdlp: boolean;
  ffmpeg: boolean;
  deno: boolean;
  ready: boolean;
}

export interface SetupProgress {
  step: string;
  percent: number;
  message: string;
}
