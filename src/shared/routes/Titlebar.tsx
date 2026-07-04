import { useLocation } from 'react-router-dom';
import { DownloadIcon, MaximizeIcon, MinusIcon, MoonIcon, SunIcon, XIcon } from 'lucide-react';
import { Box } from '@/shared/components/layout/Box';
import { Stack } from '@/shared/components/layout/Stack';
import { Text } from '@/shared/components/ui/typography';
import { t } from '@/shared/lib/messages/t';
import { closeWindow, minimizeWindow, toggleMaximizeWindow } from '@/shared/lib/window';
import { useUiStore } from '@/shared/stores/useUiStore';
import { AppPath } from './app-path';

const sectionTitle = (pathname: string): string => {
  const titles: Record<string, string> = {
    [AppPath.DESCARGAR]: t.common.download(),
    [AppPath.BUSCAR]: t.common.search(),
    [AppPath.YOUTUBE]: t.common.myYoutube(),
    [AppPath.COLA]: t.shell.navQueue(),
    [AppPath.BIBLIOTECA]: t.common.library(),
    [AppPath.AJUSTES]: t.common.settings(),
  };
  return titles[pathname] ?? '';
};

interface WindowButtonProps {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}

const WindowButton = ({ title, onClick, children }: WindowButtonProps) => (
  <button
    type="button"
    title={title}
    onClick={onClick}
    className="flex h-7.5 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
  >
    {children}
  </button>
);

export const Titlebar = () => {
  const { pathname } = useLocation();
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);

  return (
    <Box
      data-tauri-drag-region
      className="z-10 flex h-11.5 flex-none select-none items-center gap-3.5 border-b border-border bg-background2 pr-2.5 pl-3.5"
    >
      <Stack direction="row" gap="sm" align="center" className="ml-1.5">
        <Box className="flex size-6.25 items-center justify-center rounded-lg bg-linear-to-br from-[#9385F4] to-[#6B58E8] shadow-[0_2px_8px_rgba(124,107,240,.4)]">
          <DownloadIcon className="size-3.5 text-white" strokeWidth={2.6} />
        </Box>
        <Text variant="inline" weight="bold" className="font-display text-body tracking-tight">
          Stash
        </Text>
      </Stack>
      <Box data-tauri-drag-region className="flex min-w-0 flex-1 items-center justify-center">
        <Text variant="body-sm" color="muted" className=" font-semibold whitespace-nowrap">
          {sectionTitle(pathname)}
        </Text>
      </Box>
      <WindowButton
        title={t.shell.toggleTheme()}
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      >
        {theme === 'dark' ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />}
      </WindowButton>
      <WindowButton title={t.shell.minimize()} onClick={() => void minimizeWindow()}>
        <MinusIcon className="size-4" />
      </WindowButton>
      <WindowButton title={t.shell.maximize()} onClick={() => void toggleMaximizeWindow()}>
        <MaximizeIcon className="size-3.5" />
      </WindowButton>
      <WindowButton title={t.shell.close()} onClick={() => void closeWindow()}>
        <XIcon className="size-4" />
      </WindowButton>
    </Box>
  );
};
