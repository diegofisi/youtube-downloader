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
import { Text } from '@/shared/components/ui/typography';
import { cn } from '@/shared/lib/utils';
import { t } from '@/shared/lib/messages/t';
import { selectActiveCount, useQueueStore } from '@/features/queue';
import { AppPath } from './app-path';

interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

export const Sidebar = () => {
  const queueCount = useQueueStore(selectActiveCount);
  const items: NavItem[] = [
    { path: AppPath.DESCARGAR, label: t.common.download(), icon: DownloadIcon },
    { path: AppPath.BUSCAR, label: t.common.search(), icon: SearchIcon },
    { path: AppPath.YOUTUBE, label: t.common.myYoutube(), icon: TvMinimalPlayIcon },
    { path: AppPath.COLA, label: t.shell.navQueue(), icon: ListVideoIcon, badge: queueCount },
    { path: AppPath.BIBLIOTECA, label: t.common.library(), icon: LibraryIcon },
    { path: AppPath.AJUSTES, label: t.common.settings(), icon: SettingsIcon },
  ];

  return (
    <Box as="nav" className="flex w-52 flex-none flex-col border-r border-border bg-side px-3 py-3.5">
      <Text variant="micro" color="muted" className="px-2.5 pt-1 pb-2 font-semibold tracking-[.7px] uppercase">
        {t.shell.navHeading()}
      </Text>
      <Stack gap="xs">
        {items.map(({ path, label, icon: Icon, badge }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-body-sm font-semibold transition-colors',
                isActive
                  ? 'bg-primary-soft text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )
            }
          >
            <Icon className="size-4" />
            <Text variant="inline" className="flex-1">{label}</Text>
            {badge !== undefined && badge > 0 && (
              <Text variant="micro"
                weight="bold"
                className="flex h-4.5 min-w-4.5 items-center justify-center rounded-[9px] bg-primary px-1.25 font-mono text-primary-foreground"
              >
                {badge}
              </Text>
            )}
          </NavLink>
        ))}
      </Stack>
      <Box className="flex-1" />
      <Text variant="caption" color="muted" className="px-2.5 pb-0.5 font-mono text-faint">
        Stash · React
      </Text>
    </Box>
  );
};
