import { useLocation } from 'react-router-dom';
import { DownloadIcon, MaximizeIcon, MinusIcon, MoonIcon, SunIcon, XIcon } from 'lucide-react';
import { Box } from '@/shared/components/layout/Box';
import { Stack } from '@/shared/components/layout/Stack';
import { Small, Span } from '@/shared/components/ui/typography';
import { t } from '@/shared/lib/i18n';
import { closeWindow, minimizeWindow, toggleMaximizeWindow } from '@/shared/lib/window';
import { useUiStore } from '@/shared/stores/useUiStore';
import { AppPath } from './app-path';

const sectionTitle = (pathname: string): string => {
  const titles: Record<string, string> = {
    [AppPath.DESCARGAR]: t('Descargar', 'Download'),
    [AppPath.BUSCAR]: t('Buscar', 'Search'),
    [AppPath.YOUTUBE]: t('Mi YouTube', 'My YouTube'),
    [AppPath.COLA]: t('Cola', 'Queue'),
    [AppPath.BIBLIOTECA]: t('Biblioteca', 'Library'),
    [AppPath.AJUSTES]: t('Ajustes', 'Settings'),
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
        <Box className="flex size-6.25 items-center justify-center rounded-lg bg-gradient-to-br from-[#9385F4] to-[#6B58E8] shadow-[0_2px_8px_rgba(124,107,240,.4)]">
          <DownloadIcon className="size-3.5 text-white" strokeWidth={2.6} />
        </Box>
        <Span weight="bold" className="font-display text-[15px] tracking-tight">
          Stash
        </Span>
      </Stack>
      <Box data-tauri-drag-region className="flex min-w-0 flex-1 items-center justify-center">
        <Small color="muted" className="text-[13px] font-semibold whitespace-nowrap">
          {sectionTitle(pathname)}
        </Small>
      </Box>
      <WindowButton
        title={t('Cambiar tema', 'Toggle theme')}
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      >
        {theme === 'dark' ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />}
      </WindowButton>
      <WindowButton title={t('Minimizar', 'Minimize')} onClick={() => void minimizeWindow()}>
        <MinusIcon className="size-4" />
      </WindowButton>
      <WindowButton title={t('Maximizar', 'Maximize')} onClick={() => void toggleMaximizeWindow()}>
        <MaximizeIcon className="size-3.5" />
      </WindowButton>
      <WindowButton title={t('Cerrar', 'Close')} onClick={() => void closeWindow()}>
        <XIcon className="size-4" />
      </WindowButton>
    </Box>
  );
};
