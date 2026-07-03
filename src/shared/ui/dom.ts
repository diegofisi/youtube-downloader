/** getElementById tipado y estricto: lanza si el elemento no existe. */
export function $<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error('Elemento no encontrado: #' + id);
  return el as T;
}
