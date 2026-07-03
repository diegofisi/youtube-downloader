/** Typed, strict getElementById: throws if the element doesn't exist. */
export function $<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error('Elemento no encontrado: #' + id);
  return el as T;
}
