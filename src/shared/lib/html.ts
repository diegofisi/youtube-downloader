/** Escapa texto para interpolarlo en innerHTML de forma segura. */
export function esc(s: string): string {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}
