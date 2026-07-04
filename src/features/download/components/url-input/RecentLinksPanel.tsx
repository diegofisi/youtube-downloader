import { Box } from '@/shared/components/layout/Box';
import { Stack } from '@/shared/components/layout/Stack';
import { Small, Span } from '@/shared/components/ui/typography';
import { t } from '@/shared/lib/i18n';
import { timeAgo } from '../../helpers/format';
import type { RecentLink } from '../../helpers/recent-links';

interface RecentLinksPanelProps {
  items: RecentLink[];
  onPick: (url: string) => void;
  onClear: () => void;
}

/** Anchored panel content: recent analyzed links + clear action (positioning by parent). */
export const RecentLinksPanel = ({ items, onPick, onClear }: RecentLinksPanelProps) => {
  if (items.length === 0) {
    return (
      <Box className="px-3 py-[18px] text-center">
        <Small className="text-xs text-faint">{t('Sin enlaces recientes', 'No recent links')}</Small>
      </Box>
    );
  }
  return (
    <>
      <Stack gap="none">
        {items.map((r) => (
          <button
            key={r.url}
            type="button"
            title={r.url}
            onClick={() => onPick(r.url)}
            className="flex w-full items-center gap-2 rounded-lg px-[9px] py-[7px] text-left transition-colors hover:bg-accent"
          >
            <Span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-foreground">{r.url}</Span>
            <Span className="flex-none text-[10.5px] text-faint">{timeAgo(r.ts)}</Span>
          </button>
        ))}
      </Stack>
      <Box className="mt-[6px] border-t border-border pt-[6px]">
        <button
          type="button"
          onClick={onClear}
          className="w-full rounded-lg p-[7px] text-[11.5px] font-semibold text-destructive transition-colors hover:bg-destructive/10"
        >
          {t('Limpiar recientes', 'Clear recents')}
        </button>
      </Box>
    </>
  );
};
