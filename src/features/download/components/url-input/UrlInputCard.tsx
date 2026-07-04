import { useEffect, useState } from 'react';
import { ArrowRightIcon, ClipboardListIcon, ClockIcon, EyeIcon, Loader2Icon } from 'lucide-react';
import { Box } from '@/shared/components/layout/Box';
import { Stack } from '@/shared/components/layout/Stack';
import { Text } from '@/shared/components/ui/typography';
import { Button } from '@/shared/components/ui/button';
import { t } from '@/shared/lib/messages/t';
import type { AnalyzeProgress } from '../../hooks/useDescargarAnalysis';
import { countLines, lineCountLabel } from '../../helpers/parse-urls';
import { clearRecents, loadRecents, type RecentLink } from '../../helpers/recent-links';
import { RecentLinksPanel } from './RecentLinksPanel';

interface UrlInputCardProps {
  urlsText: string;
  isAnalyzing: boolean;
  progress: AnalyzeProgress | null;
  onUrlsTextChange: (text: string) => void;
  onPickRecent: (url: string) => void;
  onAnalyze: () => void;
  onGoYoutube: () => void;
}

export const UrlInputCard = ({
  urlsText,
  isAnalyzing,
  progress,
  onUrlsTextChange,
  onPickRecent,
  onAnalyze,
  onGoYoutube,
}: UrlInputCardProps) => {
  const [recentsOpen, setRecentsOpen] = useState(false);
  const [recents, setRecents] = useState<RecentLink[]>([]);

  useEffect(() => {
    if (!recentsOpen) return;
    const onDocClick = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el?.closest('[data-recents-anchor]')) setRecentsOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setRecentsOpen(false);
    };
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [recentsOpen]);

  const toggleRecents = () => {
    if (!recentsOpen) setRecents(loadRecents());
    setRecentsOpen((open) => !open);
  };

  return (
    <Box className="rounded-2xl border border-border bg-panel p-4 shadow-stash">
      <Box data-recents-anchor className="relative mb-2.75 flex items-center gap-2">
        <ClipboardListIcon className="size-4 flex-none text-primary" />
        <Text variant="body-sm" className=" font-semibold">{t.download.pasteLinksTitle()}</Text>
        <Text variant="caption" className="ml-auto font-mono text-faint">{lineCountLabel(countLines(urlsText))}</Text>
        <button
          type="button"
          title={t.download.recentLinksTitle()}
          onClick={toggleRecents}
          className="flex h-6.5 flex-none items-center gap-1.25 rounded-lg border border-border2 px-2.25 text-caption font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ClockIcon className="size-3.25" />
          {t.download.recent()}
        </button>
        {recentsOpen && (
          <Box className="absolute top-[calc(100%+8px)] right-0 z-40 max-h-80 w-85 overflow-y-auto rounded-xl border border-border2 bg-panel p-1.5 shadow-stash">
            <RecentLinksPanel
              items={recents}
              onPick={onPickRecent}
              onClear={() => {
                clearRecents();
                setRecents([]);
              }}
            />
          </Box>
        )}
      </Box>
      <textarea
        value={urlsText}
        onChange={(e) => onUrlsTextChange(e.target.value)}
        spellCheck={false}
        placeholder={t.download.pastePlaceholder()}
        className="h-24 w-full resize-y rounded-[10px] border border-border bg-background px-3.25 py-2.75 font-mono text-body-sm leading-[1.7] text-foreground outline-none placeholder:text-faint focus-visible:border-primary"
      />
      <Stack direction="row" gap="sm" align="center" className="mt-3 gap-2.5">
        <Button onClick={onAnalyze} disabled={isAnalyzing} className="h-9.5 px-4.5 text-body-sm">
          {isAnalyzing ? <Loader2Icon className="animate-spin" /> : <EyeIcon />}
          {isAnalyzing
            ? progress
              ? `${progress.done}/${progress.total}…`
              : t.download.analyzing()
            : t.download.previewButton()}
        </Button>
        <Box className="flex-1" />
        <Button variant="ghost" onClick={onGoYoutube} className="h-9.5 px-1.5 text-body-sm font-medium">
          {t.download.orBrowseYoutube()}
          <ArrowRightIcon className="size-3.75" />
        </Button>
      </Stack>
    </Box>
  );
};
