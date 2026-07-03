/** Escapes text for safe interpolation into innerHTML. */
export function esc(s: string): string {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}
