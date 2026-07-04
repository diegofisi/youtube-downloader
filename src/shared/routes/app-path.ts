/** Single source of truth for routes — never hardcode path strings. */
export const AppPath = {
  ROOT: '/',
  DESCARGAR: '/descargar',
  BUSCAR: '/buscar',
  YOUTUBE: '/youtube',
  COLA: '/cola',
  BIBLIOTECA: '/biblioteca',
  AJUSTES: '/ajustes',
  ANY: '*',
} as const;

export type AppPath = keyof typeof AppPath;
