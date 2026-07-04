import { NavLink } from 'react-router-dom';
import {
  DownloadIcon,
  LibraryIcon,
  ListVideoIcon,
  SearchIcon,
  SettingsIcon,
  TvMinimalPlayIcon,
  type LucideIcon,
} from 'lucide-react';
import { Box } from '@/shared/components/layout/Box';
import { Stack } from '@/shared/components/layout/Stack';
import { Small, Span } from '@/shared/components/ui/typography';
import { cn } from '@/shared/lib/utils';
import { t } from '@/shared/lib/i18n';
import { selectActiveCount, useQueueStore } from '@/features/queue';
import { AppPath } from './app-path';

interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  /** Live item count shown on the right (Cola only). */
  badge?: number;
}

export const Sidebar = () => {
  // Replaces the vanilla 'queue:count' bus event with a narrow store selector.
  const queueCount = useQueueStore(selectActiveCount);
  const items: NavItem[] = [
    { path: AppPath.DESCARGAR, label: t('Descargar', 'Download'), icon: DownloadIcon },
    { path: AppPath.BUSCAR, label: t('Buscar', 'Search'), icon: SearchIcon },
    { path: AppPath.YOUTUBE, label: t('Mi YouTube', 'My YouTube'), icon: TvMinimalPlayIcon },
    { path: AppPath.COLA, label: t('Cola', 'Queue'), icon: ListVideoIcon, badge: queueCount },
    { path: AppPath.BIBLIOTECA, label: t('Biblioteca', 'Library'), icon: LibraryIcon },
    { path: AppPath.AJUSTES, label: t('Ajustes', 'Settings'), icon: SettingsIcon },
  ];

  return (
    <Box as="nav" className="flex w-52 flex-none flex-col border-r border-border bg-side px-3 py-3.5">
      <Small color="muted" className="px-2.5 pt-1 pb-2 text-[10.5px] font-semibold tracking-[.7px] uppercase">
        {t('Navegación', 'Navigation')}
      </Small>
      <Stack gap="xs">
        {items.map(({ path, label, icon: Icon, badge }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-[13px] font-semibold transition-colors',
                isActive
                  ? 'bg-primary-soft text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )
            }
          >
            <Icon className="size-4" />
            <Span className="flex-1">{label}</Span>
            {badge !== undefined && badge > 0 && (
              <Span
                weight="bold"
                className="flex h-4.5 min-w-4.5 items-center justify-center rounded-[9px] bg-primary px-1.25 font-mono text-[10.5px] text-primary-foreground"
              >
                {badge}
              </Span>
            )}
          </NavLink>
        ))}
      </Stack>
      <Box className="flex-1" />
      <Small color="muted" className="px-2.5 pb-0.5 font-mono text-[11px] text-faint">
        Stash · React
      </Small>
    </Box>
  );
};
