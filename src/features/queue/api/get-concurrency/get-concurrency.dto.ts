/** Partial mirror of Rust AppConfig (snake_case) — the queue only needs the
 * concurrency; the settings slice owns the full DTO for the same ['settings'] cache. */
export interface ConcurrencySettingsDTOResponse {
  default_concurrency: number;
}
